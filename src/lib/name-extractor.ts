/**
 * 메일 본문에서 바이어 실명을 경량 정규식 및 패턴 매칭으로 추출한다.
 * LLM을 호출하지 않으며, 패턴이 불명확한 경우 억지로 지어내지 않고 공란(또는 fallback)을 반환한다.
 */
export function extractBuyerNameFromBody(bodyText?: string | null, fallbackName?: string): string {
  if (!bodyText || typeof bodyText !== "string") {
    return fallbackName?.trim() || "";
  }

  const clean = bodyText.trim();
  const lowerExcluded = new Set(["team", "support", "sales", "info", "admin", "service", "customer", "contact", "us", "help", "staff", "medi", "kos", "medidakos"]);

  // 1. 영문 서명 패턴 (하단 Sign-off)
  // 예: "Best regards,\nJohn Doe", "Sincerely,\nTariq Al-Mansoor", "Best,\nJan de Vries"
  const nameParticle = "(?:de|van|von|da|del|der|al|el|bin|la|le|[A-Z][a-zA-Z'\\-]*)";
  let signOffName = "";
  const enSignOff = new RegExp(
    `(?:[Bb]est regards|[Ww]arm regards|[Kk]ind regards|[Ww]armest regards|[Rr]egards|[Tt]hanks & regards|[Tt]hanks and regards|[Tt]hanks|[Tt]hank you|[Ss]incerely|[Cc]heers|[Bb]est)[,\\s]*\\r?\\n+([A-Z][a-zA-Z'\\-]+(?:[ \\t]+${nameParticle}){0,2})(?=[ \\t]*\\r?\\n|$|[,.])`
  );
  const signMatch = clean.match(enSignOff);
  if (signMatch && signMatch[1].trim().length >= 2) {
    const candidate = signMatch[1].trim();
    if (!lowerExcluded.has(candidate.toLowerCase())) {
      signOffName = candidate;
    }
  }

  // 2. 영문 자기소개 패턴 (첫머리 소개)
  // 예: "My name is Sarah Connor", "I'm Tan Wei Ling", "This is Tariq Al-Mansoor", "My name is Jan de Vries"
  let introName = "";
  const enIntro = new RegExp(
    `\\b(?:[Mm]y name is|[Ii] am|[Tt]his is|[Ii]'m)\\s+([A-Z][a-zA-Z'\\-]+(?:[ \\t]+${nameParticle}){0,2})(?=\\s+(?:and|from|with|for|representing|who|at|owner|founder|ceo|director)|\\s|$|[,.\\r\\n])`
  );
  const introMatch = clean.match(enIntro);
  if (introMatch && introMatch[1].trim().length >= 2) {
    const candidate = introMatch[1].trim();
    const introExcluded = new Set([...lowerExcluded, "interested", "writing", "looking", "contacting", "reaching", "hoping", "and", "from", "with"]);
    if (!introExcluded.has(candidate.toLowerCase())) {
      introName = candidate;
    }
  }

  // 자기소개에 성과 이름(2단어 이상)이 있고 서명이 1단어인 경우 풀네임 우선
  if (introName.includes(" ") && (!signOffName || !signOffName.includes(" "))) {
    return introName;
  }
  if (signOffName) {
    return signOffName;
  }
  if (introName) {
    return introName;
  }

  // 3. 국문 자기소개 패턴
  // 예: "안녕하세요, 뷰티코스메틱의 홍길동 팀장입니다", "안녕하세요 홍길동입니다"
  const koTitles = "팀장|대표|과장|대리|매니저|담당자|이사|실장|연구원|연구소장|부장|차장|사원";
  const koIntro = new RegExp(
    `(?:안녕하세요[,\s]*)?(?:[가-힣A-Za-z0-9]+(?:\\s+[가-힣A-Za-z0-9]+)*?(?:의|에서\\s*근무하는|소속)?\\s+)?([가-힣]{2,4})\\s*(?:(?:${koTitles})\\s*)?입니다`
  );
  const koIntroMatch = clean.match(koIntro);
  if (koIntroMatch && koIntroMatch[1].trim().length >= 2) {
    const koName = koIntroMatch[1].trim();
    const koExcluded = new Set(["안녕하세요", "문의", "견적", "화장품", "뷰티", "회사", "제품", "담당자", "마케팅", "수분크림", "세럼", "토너"]);
    if (!koExcluded.has(koName)) {
      return koName;
    }
  }

  // 4. 국문 서명 패턴
  // 예: "김철수 드림", "홍길동 올림"
  const koSign = /(?:^|\r?\n|\s)([가-힣]{2,4})\s*(?:드림|올림|배상)(?=[^가-힣A-Za-z0-9]|$)/;
  const koSignMatch = clean.match(koSign);
  if (koSignMatch && koSignMatch[1].trim().length >= 2) {
    const koName = koSignMatch[1].trim();
    const koExcluded = new Set(["감사", "수고", "문의"]);
    if (!koExcluded.has(koName)) {
      return koName;
    }
  }

  return fallbackName?.trim() || "";
}

function cleanBrandCandidate(raw: string): string {
  let s = raw.trim().replace(/[,;:]+$/, "");
  // 문장 끝 마침표 제거 (단, S.A., B.V., S.r.l. 등 복합 약어는 보존)
  if (s.endsWith(".")) {
    const isAcronym = /(?:S\.A|B\.V|S\.r\.l)\.$/i.test(s);
    if (!isAcronym) {
      s = s.replace(/\.+$/, "").trim();
    }
  }
  return s;
}

/**
 * 이메일 본문 또는 이메일 주소 도메인에서 브랜드명 / 회사명을 정규식 기반으로 추출한다.
 */
export interface BrandCandidate {
  value: string;
  source: "outbound_history" | "from_name" | "domain" | "url" | "signature" | "body";
  confidence: "high" | "medium" | "low";
  label: string;
}

const genericDomains = new Set([
  "gmail", "yahoo", "hotmail", "outlook", "icloud", "naver", "daum", "kakao",
  "proton", "protonmail", "mail", "zoho", "yandex", "gmx", "aol", "live", "msn",
]);

const excludedBrands = new Set([
  "korea", "south korea", "china", "usa", "united states", "medidakos", "medi da kos",
  "instagram", "amazon", "shopify", "google", "oem", "odm", "skincare", "cosmetics",
  "beauty", "brand", "company", "products", "serum", "cream", "moq", "quote", "inquiry",
  "hello", "hi", "dear", "thanks", "sample", "catalog", "order", "our", "my", "your",
  "their", "the", "a", "an", "this", "these", "that", "those", "all", "some", "each",
  "every", "both", "few", "many", "any", "new", "current", "existing", "various", "different",
  "here", "there", "us", "we", "team", "range", "side", "end", "line", "website", "site",
  "page", "scratch", "overseas", "domestic", "home", "market", "office", "store", "shop",
  "based", "located", "seeking", "contacting", "planning", "ready", "hoping", "writing",
  "reaching", "interested", "looking",
]);

/**
 * 이메일 본문, 발신자명, 도메인, 스레드 이력 등 다층 데이터 소스로부터
 * 신뢰도 높은 브랜드명 후보군(BrandCandidate[])을 계층적으로 추출한다.
 */
export function extractBrandCandidates(options: {
  bodyText?: string | null;
  fromName?: string | null;
  email?: string | null;
  messages?: Array<{ subject?: string; bodyText?: string; direction?: string }>;
}): BrandCandidate[] {
  const { bodyText, fromName, email, messages = [] } = options;
  const candidates: BrandCandidate[] = [];
  const seen = new Set<string>();

  function addCandidate(
    value: string,
    source: BrandCandidate["source"],
    confidence: BrandCandidate["confidence"],
    label: string,
  ) {
    const cleaned = cleanBrandCandidate(value);
    if (!cleaned || cleaned.length < 2) return;
    const lower = cleaned.toLowerCase();
    if (excludedBrands.has(lower)) return;
    if (seen.has(lower)) return;
    seen.add(lower);
    candidates.push({ value: cleaned, source, confidence, label });
  }

  // 1. 아웃바운드 / 이전 발신 콜드메일 이력 분석 (신뢰도 최상위)
  const allTexts: string[] = [];
  if (bodyText) allTexts.push(bodyText);
  for (const m of messages) {
    if (m.subject) allTexts.push(`Subject: ${m.subject}`);
    if (m.bodyText) allTexts.push(m.bodyText);
  }
  const combinedText = allTexts.join("\n");

  // 1-1. 콜드메일 제목 패턴: "for the [Brand] team", "for [Brand] team", "A note for [Brand]"
  const subjectBrandMatch = combinedText.match(/(?:for the|for)\s+([A-Z0-9][A-Za-z0-9&'’\s\-]{1,35}?)\s+team/i);
  if (subjectBrandMatch && subjectBrandMatch[1]) {
    addCandidate(subjectBrandMatch[1], "outbound_history", "high", "발신 메일 이력");
  }

  // 1-2. 콜드메일 링크 UTM 패턴: "utm_term=([a-z0-9\-]+)"
  const utmMatch = combinedText.match(/utm_term=([a-z0-9\-]{2,40})/i);
  if (utmMatch && utmMatch[1]) {
    const utmBrand = utmMatch[1]
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    addCandidate(utmBrand, "outbound_history", "high", "캠페인 UTM 태그");
  }

  // 1-3. 콜드메일 본문 서두 패턴: "[Brand] runs mushroom actives..."
  const runsMatch = combinedText.match(/(?:^|\n)\s*([A-Z0-9][A-Za-z0-9&'’\s\-]{1,35}?)\s+runs\s+/i);
  if (runsMatch && runsMatch[1]) {
    addCandidate(runsMatch[1], "outbound_history", "high", "발신 본문 분석");
  }

  // 2. 발신자 표시명(fromName) 정제 (신뢰도 높음)
  if (fromName && typeof fromName === "string") {
    // "Kinoko Customer Care" -> "Kinoko", "BHR Skincare Team" -> "BHR Skincare"
    const cleanedFromName = fromName
      .replace(/\b(?:customer\s+care|customer\s+support|support\s+team|sales\s+team|support|care|team|staff|official|hq|info|inquiry)\b/gi, "")
      .replace(/[,;:\-]+$/, "")
      .trim();
    if (cleanedFromName.length >= 2 && !cleanedFromName.includes("@")) {
      addCandidate(cleanedFromName, "from_name", "high", "발신자 표시명");
    }
  }

  // 3. 본문 내 웹사이트 패턴 & 서명 블록 접미사
  const bodyExtracted = extractBrandNameFromBody(bodyText, email);
  if (bodyExtracted) {
    addCandidate(bodyExtracted, "signature", "medium", "본문/서명 추출");
  }

  // 4. 이메일 도메인 및 링크 도메인 분석 (접미사 분리 e.g. kinokolabs -> Kinoko Labs)
  if (email && typeof email === "string" && email.includes("@")) {
    const domainPart = email.split("@")[1]?.split(".")[0]?.toLowerCase();
    if (domainPart && !genericDomains.has(domainPart) && domainPart.length >= 3) {
      const domainFormatted = domainPart
        .replace(/(labs|skincare|cosmetics|beauty|pharma|studio|brand|organics|botanicals)$/i, " $1")
        .trim()
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      addCandidate(domainFormatted, "domain", "medium", "이메일 도메인");
    }
  }

  return candidates;
}

/**
 * 이메일 본문 또는 이메일 주소 도메인에서 브랜드명 / 회사명을 정규식 기반으로 추출한다.
 */
export function extractBrandNameFromBody(bodyText?: string | null, email?: string | null): string {
  if (bodyText && typeof bodyText === "string") {
    const clean = bodyText.trim();
    const delimiter = "(?=\\s+(?:and|who|which|we|i|in|based|located|looking|interested|to|representing|for|shipping)|\\r?\\n|[,;]|(?:\\.\\s+[A-Z])|\\.$)";

    // 1. "Our brand is [Brand]", "Brand: [Brand]", "Company: [Brand]", "website, [Brand]"
    const explicitBrandRegex = new RegExp(
      `\\b(?:my brand(?:'s)?(?: name)? is|our brand(?:'s)?(?: name)? is|our company(?:'s)?(?: name)? is|\\bbrand is\\b|\\bbrand name\\b:?|\\bbrand\\b\\s*:|\\bcompany name\\b:?|\\bcompany\\b\\s*:|(?:our\\s+)?website[,\\s]+(?:is\\s*)?)\\s*[:\\-]?\\s*([A-Z0-9][A-Za-z0-9&'’\\- ]{1,35}?(?:\\.(?:[A-Za-z]\\.)*)?)` + delimiter,
      "i"
    );
    const explicitMatch = clean.match(explicitBrandRegex);
    if (explicitMatch && explicitMatch[1].trim().length >= 2) {
      const candidate = cleanBrandCandidate(explicitMatch[1]);
      if (!excludedBrands.has(candidate.toLowerCase())) {
        return candidate;
      }
    }

    // 2. 서명 블록 내 회사 접미사 (단일 줄 매칭)
    // 예: "Kinoko Labs", "Acme Cosmetics LLC", "Luxe Orient Skincare", "BHR Skincare Inc.", "Glow Lab Pty Ltd", "Kyoto Botanicals Ltd"
    const companySuffixRegex = /(?:^|\r?\n)\s*(?!(?:we|i|my|this|hello|hi|dear|thanks|thank|please|could|regards|for|our)\b)([A-Z0-9][A-Za-z0-9&'’.\- ]{1,35}?(?:Inc\.?|LLC|Ltd\.?|Co\.,?\s*Ltd\.?|Pty\s*Ltd|Pvt\s*Ltd|Pte\s*Ltd|GmbH|S\.?A\.?|S\.?A\.?S\.?|S\.?r\.?l\.?|B\.?V\.?|Corp\.?|Corporation|Holdings|Enterprises|Labs?|Laboratories|Skincare|Cosmetics|Beauty|Pharma|Studio|Consulting|Group|Brand|Paris|London|New York|Tokyo|Seoul))\s*(?=\r?\n|[,;]|$)/i;
    const suffixMatch = clean.match(companySuffixRegex);
    if (suffixMatch && suffixMatch[1].trim().length >= 2) {
      const candidate = cleanBrandCandidate(suffixMatch[1]);
      if (!excludedBrands.has(candidate.toLowerCase())) {
        return candidate;
      }
    }

    // 3. "We are [Brand]" 소개 패턴
    const weAreBrandRegex = new RegExp(
      `\\b(?:we are|we're)\\s+(?!(?:our|my|your|their|the|a|an|this|these|that|those|based|located|seeking|contacting|planning|ready|hoping|writing|reaching|interested|looking)\\b)\\s*([A-Z0-9][A-Za-z0-9&'’\\- ]{1,35}?)` + delimiter,
      "i"
    );
    const weAreMatch = clean.match(weAreBrandRegex);
    if (weAreMatch && weAreMatch[1].trim().length >= 2) {
      const candidate = cleanBrandCandidate(weAreMatch[1]);
      if (!excludedBrands.has(candidate.toLowerCase())) {
        return candidate;
      }
    }

    // 4. 직책 및 소속 패턴: "founder of [Brand]", "from [Brand]", "with [Brand]", "representing [Brand]", "Head of Product at [Brand]"
    // (our, my, the 등 대명사/관사를 부정 lookahead로 제외하여 "from our range" 오탐 방지)
    const introBrandRegex = new RegExp(
      `\\b(?:from|with|representing|on behalf of|founder of|co-founder of|ceo of|owner of|managing director of|head of (?:product|purchasing|sourcing|development) at|procurement manager at|director of|president of|at)\\s+(?!(?:our|my|your|their|the|a|an|this|these|that|those|looking|interested)\\b)\\s*([A-Z0-9][A-Za-z0-9&'’\\- ]{1,35}?(?:\\.(?:[A-Za-z]\\.)*)?)` + delimiter,
      "i"
    );
    const introMatch = clean.match(introBrandRegex);
    if (introMatch && introMatch[1].trim().length >= 2) {
      const candidate = cleanBrandCandidate(introMatch[1]);
      if (!excludedBrands.has(candidate.toLowerCase())) {
        return candidate;
      }
    }

    // 4. 국문 회사명/브랜드명 패턴:
    // (1) "주식회사 [회사명]", "(주)[회사명]"
    const koCorpRegex = /(?:주식회사|\(주\))\s*([가-힣A-Za-z0-9&'’]{2,20}?)(?:의|에서|은|는|이|가|\s|$)/;
    const koCorpMatch = clean.match(koCorpRegex);
    if (koCorpMatch && koCorpMatch[1].trim().length >= 2) {
      const candidate = cleanBrandCandidate(koCorpMatch[1]);
      if (!excludedBrands.has(candidate.toLowerCase())) {
        return candidate;
      }
    }

    // (2) "안녕하세요 [브랜드명]의 [이름]입니다"
    const koBrandRegex = /(?:안녕하세요[,\s]*)?([가-힣A-Za-z0-9&'’]{2,20})(?:의|에서\s*근무하는|소속)\s+[가-힣A-Za-z]{2,10}/;
    const koBrandMatch = clean.match(koBrandRegex);
    if (koBrandMatch && koBrandMatch[1].trim().length >= 2) {
      const candidate = cleanBrandCandidate(koBrandMatch[1]);
      if (!excludedBrands.has(candidate.toLowerCase())) {
        return candidate;
      }
    }
  }

  // 5. 이메일 도메인 fallback
  if (email && typeof email === "string" && email.includes("@")) {
    const domainPart = email.split("@")[1]?.split(".")[0]?.toLowerCase();
    if (domainPart && !genericDomains.has(domainPart) && domainPart.length >= 3) {
      return domainPart.charAt(0).toUpperCase() + domainPart.slice(1);
    }
  }

  return "";
}

/**
 * 메일 본문에서 바이어 소재 국가를 정규식 및 키워드/우편번호 패턴으로 추출한다.
 */
export function extractCountryFromBody(bodyText?: string | null): string {
  if (!bodyText || typeof bodyText !== "string") {
    return "";
  }

  const text = bodyText.trim();

  // 국가 목록 및 패턴 정의 (우선순위: 배송지/위치/시장 명시 문맥 우선)
  const COUNTRY_RULES: Array<{ label: string; regex: RegExp; contextRegex: RegExp }> = [
    // 1. 북미 (North America)
    {
      label: "미국 (USA)",
      regex: /\b(?:united states|usa|u\.s\.a\.|u\.s\.|america|california|new york|texas|florida|washington|illinois|new jersey|georgia|north carolina|virginia|ohio|colorado|arizona|massachusetts|michigan|pennsylvania|south carolina|nevada|oregon|utah|tennessee|indiana|missouri|maryland|wisconsin|minnesota|alabama|louisiana|kentucky|oklahoma|connecticut|iowa|arkansas|mississippi|kansas|new mexico|nebraska|idaho|hawaii|new hampshire|maine|rhode island|montana|delaware|south dakota|north dakota|alaska|vermont|wyoming|los angeles|san francisco|san diego|san jose|miami|orlando|tampa|chicago|houston|dallas|austin|seattle|atlanta|boston|las vegas|denver|phoenix|philadelphia|portland|myrtle beach|beverly hills|[A-Z]{2}\s+\d{5}(?:-\d{4})?)\b|미국/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|freight to|port of|destination:?|based in|located in|office in|warehouse in|market in|in the|for the)\s+(?:the\s+)?(?:united states|usa|u\.s\.a\.|u\.s\.|america|us market|american market|california|new york|texas|florida|washington|illinois|new jersey|georgia|colorado|arizona|pennsylvania|nevada|oregon|myrtle beach|los angeles|san francisco|miami|chicago|houston|seattle|atlanta|boston|las vegas|[A-Z]{2}\s+\d{5}|미국)/i,
    },
    {
      label: "캐나다 (Canada)",
      regex: /\b(?:canada|canadian|ontario|british columbia|quebec|alberta|manitoba|saskatchewan|nova scotia|toronto|vancouver|montreal|calgary|ottawa|edmonton|mississauga|winnipeg|[A-Z]\d[A-Z]\s*\d[A-Z]\d)\b|캐나다/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|freight to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:canada|canadian market|ontario|british columbia|quebec|alberta|toronto|vancouver|montreal|calgary|ottawa|캐나다)/i,
    },
    {
      label: "멕시코 (Mexico)",
      regex: /\b(?:mexico|mexican|mexico city|guadalajara|monterrey|cancun|tijuana|puebla)\b|멕시코/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:mexico|mexican market|mexico city|guadalajara|monterrey|cancun|멕시코)/i,
    },

    // 2. 유럽 (Europe)
    {
      label: "영국 (UK)",
      regex: /\b(?:united kingdom|uk|u\.k\.|great britain|britain|england|scotland|wales|northern ireland|london|manchester|birmingham|leeds|glasgow|edinburgh|liverpool|bristol|cardiff|belfast|[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b|영국/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:united kingdom|uk|u\.k\.|great britain|britain|uk market|british market|england|london|manchester|birmingham|edinburgh|영국)/i,
    },
    {
      label: "프랑스 (France)",
      regex: /\b(?:france|french|paris|marseille|lyon|toulouse|nice|nantes|bordeaux|lille|strasbourg)\b|프랑스/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:france|french market|paris|marseille|lyon|bordeaux|프랑스)/i,
    },
    {
      label: "독일 (Germany)",
      regex: /\b(?:germany|german|deutschland|berlin|munich|frankfurt|hamburg|cologne|stuttgart|dusseldorf|düsseldorf|dortmund|leipzig|nuremberg)\b|독일/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:germany|german market|deutschland|berlin|munich|frankfurt|hamburg|dusseldorf|독일)/i,
    },
    {
      label: "네덜란드 (Netherlands)",
      regex: /\b(?:netherlands|the netherlands|holland|dutch|amsterdam|rotterdam|the hague|utrecht|eindhoven|groningen)\b|네덜란드/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:netherlands|the netherlands|holland|dutch market|amsterdam|rotterdam|utrecht|네덜란드)/i,
    },
    {
      label: "이탈리아 (Italy)",
      regex: /\b(?:italy|italian|italia|rome|milan|milano|naples|turin|florence|bologna|venice|verona)\b|이탈리아/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:italy|italian market|rome|milan|milano|florence|venice|이탈리아)/i,
    },
    {
      label: "스페인 (Spain)",
      regex: /\b(?:spain|spanish|espana|españa|madrid|barcelona|valencia|seville|zaragoza|malaga|bilbao)\b|스페인/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:spain|spanish market|madrid|barcelona|valencia|seville|스페인)/i,
    },
    {
      label: "스위스 (Switzerland)",
      regex: /\b(?:switzerland|swiss|zurich|geneva|basel|bern|lausanne|lucerne)\b|스위스/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:switzerland|swiss market|zurich|geneva|basel|스위스)/i,
    },
    {
      label: "스웨덴 (Sweden)",
      regex: /\b(?:sweden|swedish|stockholm|gothenburg|malmo|malmö|uppsala)\b|스웨덴/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:sweden|swedish market|stockholm|gothenburg|스웨덴)/i,
    },
    {
      label: "노르웨이 (Norway)",
      regex: /\b(?:norway|norwegian|oslo|bergen|trondheim|stavanger)\b|노르웨이/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:norway|norwegian market|oslo|bergen|노르웨이)/i,
    },
    {
      label: "덴마크 (Denmark)",
      regex: /\b(?:denmark|danish|copenhagen|aarhus|odense|aalborg)\b|덴마크/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:denmark|danish market|copenhagen|aarhus|덴마크)/i,
    },
    {
      label: "폴란드 (Poland)",
      regex: /\b(?:poland|polish|polska|warsaw|krakow|kraków|gdansk|gdańsk|wroclaw|wrocław|poznan|poznań)\b|폴란드/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:poland|polish market|warsaw|krakow|gdansk|폴란드)/i,
    },
    {
      label: "벨기에 (Belgium)",
      regex: /\b(?:belgium|belgian|brussels|antwerp|ghent|bruges|liege)\b|벨기에/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:belgium|belgian market|brussels|antwerp|벨기에)/i,
    },
    {
      label: "오스트리아 (Austria)",
      regex: /\b(?:austria|austrian|vienna|salzburg|innsbruck|graz|linz)\b|오스트리아/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:austria|austrian market|vienna|salzburg|오스트리아)/i,
    },
    {
      label: "아일랜드 (Ireland)",
      regex: /\b(?:ireland|irish|dublin|cork|galway|limerick)\b|아일랜드/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:ireland|irish market|dublin|cork|아일랜드)/i,
    },
    {
      label: "포르투갈 (Portugal)",
      regex: /\b(?:portugal|portuguese|lisbon|porto|braga|coimbra)\b|포르투갈/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:portugal|portuguese market|lisbon|porto|포르투갈)/i,
    },
    {
      label: "그리스 (Greece)",
      regex: /\b(?:greece|greek|athens|thessaloniki|patras|heraklion)\b|그리스/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:greece|greek market|athens|thessaloniki|그리스)/i,
    },
    {
      label: "체코 (Czech Republic)",
      regex: /\b(?:czech republic|czechia|prague|brno|ostrava|plzen)\b|체코/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:czech republic|czechia|prague|brno|체코)/i,
    },
    {
      label: "헝가리 (Hungary)",
      regex: /\b(?:hungary|hungarian|budapest|debrecen|szeged)\b|헝가리/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:hungary|hungarian market|budapest|헝가리)/i,
    },
    {
      label: "루마니아 (Romania)",
      regex: /\b(?:romania|romanian|bucharest|cluj|timisoara|iasi)\b|루마니아/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:romania|romanian market|bucharest|루마니아)/i,
    },
    {
      label: "튀르키예 (Turkey)",
      regex: /\b(?:turkey|turkish|türkiye|istanbul|ankara|izmir|bursa|antalya)\b|터키|튀르키예/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:turkey|turkish market|türkiye|istanbul|ankara|izmir|터키|튀르키예)/i,
    },

    // 3. 아시아 (Asia)
    {
      label: "인도 (India)",
      regex: /\b(?:india|indian|mumbai|delhi|new delhi|bangalore|bengaluru|hyderabad|telangana|chennai|kolkata|pune|ahmedabad|jaipur|surat|PIN\s*\d{6})\b|인도/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:india|indian market|mumbai|delhi|bangalore|hyderabad|telangana|chennai|pune|인도)/i,
    },
    {
      label: "파키스탄 (Pakistan)",
      regex: /\b(?:pakistan|pakistani|karachi|lahore|islamabad|rawalpindi|faisalabad|peshawar|multan)\b|파키스탄/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:pakistan|pakistani market|karachi|lahore|islamabad|rawalpindi|faisalabad|파키스탄)/i,
    },
    {
      label: "방글라데시 (Bangladesh)",
      regex: /\b(?:bangladesh|bangladeshi|dhaka|chittagong|khulna)\b|방글라데시/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:bangladesh|bangladeshi market|dhaka|방글라데시)/i,
    },
    {
      label: "일본 (Japan)",
      regex: /\b(?:japan|japanese|tokyo|osaka|kyoto|yokohama|fukuoka|nagoya|sapporo|kobe)\b|일본/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:japan|japanese market|tokyo|osaka|kyoto|fukuoka|nagoya|일본)/i,
    },
    {
      label: "싱가포르 (Singapore)",
      regex: /\b(?:singapore|singaporean)\b|싱가포르|싱가폴/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:singapore|singaporean market|싱가포르)/i,
    },
    {
      label: "말레이시아 (Malaysia)",
      regex: /\b(?:malaysia|malaysian|kuala lumpur|kl|penang|johor bahru|selangor|kota kinabalu)\b|말레이시아/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:malaysia|malaysian market|kuala lumpur|penang|johor bahru|말레이시아)/i,
    },
    {
      label: "베트남 (Vietnam)",
      regex: /\b(?:vietnam|vietnamese|hanoi|ho chi minh|saigon|da nang|hai phong|can tho)\b|베트남/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:vietnam|vietnamese market|hanoi|ho chi minh|saigon|da nang|베트남)/i,
    },
    {
      label: "태국 (Thailand)",
      regex: /\b(?:thailand|thai|bangkok|phuket|chiang mai|pattaya|nonthaburi)\b|태국/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:thailand|thai market|bangkok|phuket|chiang mai|태국)/i,
    },
    {
      label: "인도네시아 (Indonesia)",
      regex: /\b(?:indonesia|indonesian|jakarta|surabaya|bandung|bali|medan|semarang|yogyakarta)\b|인도네시아/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:indonesia|indonesian market|jakarta|surabaya|bandung|bali|인도네시아)/i,
    },
    {
      label: "필리핀 (Philippines)",
      regex: /\b(?:philippines|filipino|philippine|manila|cebu|davao|quezon city|makati)\b|필리핀/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:philippines|filipino market|manila|cebu|davao|필리핀)/i,
    },
    {
      label: "대만 (Taiwan)",
      regex: /\b(?:taiwan|taiwanese|taipei|kaohsiung|taichung|tainan)\b|대만/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:taiwan|taiwanese market|taipei|kaohsiung|대만)/i,
    },
    {
      label: "홍콩 (Hong Kong)",
      regex: /\b(?:hong kong|hk|kowloon|central hk)\b|홍콩/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:hong kong|hk|kowloon|홍콩)/i,
    },
    {
      label: "중국 (China)",
      regex: /\b(?:china|chinese|shanghai|beijing|shenzhen|guangzhou|hangzhou|chengdu)\b|중국/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:china|chinese market|shanghai|beijing|shenzhen|guangzhou|중국)/i,
    },
    {
      label: "몽골 (Mongolia)",
      regex: /\b(?:mongolia|mongolian|ulaanbaatar)\b|몽골/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:mongolia|ulaanbaatar|몽골)/i,
    },
    {
      label: "캄보디아 (Cambodia)",
      regex: /\b(?:cambodia|cambodian|phnom penh)\b|캄보디아/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:cambodia|phnom penh|캄보디아)/i,
    },

    // 4. 중동 (Middle East)
    {
      label: "사우디아라비아 (Saudi Arabia)",
      regex: /\b(?:saudi arabia|saudi|ksa|riyadh|jeddah|dammam|mecca|medina|khobar|tabuk)\b|사우디(?:아라비아)?/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:saudi arabia|saudi|ksa|saudi market|riyadh|jeddah|dammam|사우디)/i,
    },
    {
      label: "아랍에미리트 (UAE)",
      regex: /\b(?:uae|u\.a\.e\.|united arab emirates|dubai|abu dhabi|sharjah|ajman|ras al khaimah)\b|아랍에미리트|두바이/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:uae|u\.a\.e\.|united arab emirates|dubai|abu dhabi|sharjah|아랍에미리트|두바이)/i,
    },
    {
      label: "카타르 (Qatar)",
      regex: /\b(?:qatar|qatari|doha|al wakrah|al rayyan)\b|카타르/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:qatar|qatari market|doha|카타르)/i,
    },
    {
      label: "쿠웨이트 (Kuwait)",
      regex: /\b(?:kuwait|kuwaiti|kuwait city|salmiya|hawalli)\b|쿠웨이트/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:kuwait|kuwaiti market|kuwait city|쿠웨이트)/i,
    },
    {
      label: "오만 (Oman)",
      regex: /\b(?:oman|omani|muscat|salalah|sohar)\b|오만/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:oman|muscat|오만)/i,
    },
    {
      label: "바레인 (Bahrain)",
      regex: /\b(?:bahrain|bahraini|manama|muharraq|riffa)\b|바레인/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:bahrain|manama|바레인)/i,
    },
    {
      label: "이스라엘 (Israel)",
      regex: /\b(?:israel|israeli|tel aviv|jerusalem|haifa|rishon lezion)\b|이스라엘/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:israel|israeli market|tel aviv|jerusalem|이스라엘)/i,
    },
    {
      label: "요르단 (Jordan)",
      regex: /\b(?:jordan|jordanian|amman|zarqa|irbid)\b|요르단/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:jordan|amman|요르단)/i,
    },
    {
      label: "레바논 (Lebanon)",
      regex: /\b(?:lebanon|lebanese|beirut|tripoli lebanon)\b|레바논/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:lebanon|beirut|레바논)/i,
    },

    // 5. 오세아니아 (Oceania)
    {
      label: "호주 (Australia)",
      regex: /\b(?:australia|australian|sydney|melbourne|brisbane|perth|adelaide|gold coast|penrith|canberra|newcastle|sunshine coast|wollongong|hobart|geelong|nsw|vic|qld|wa)\b|호주|오스트레일리아/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|freight to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:australia|australian market|sydney|melbourne|brisbane|perth|adelaide|gold coast|penrith|호주)/i,
    },
    {
      label: "뉴질랜드 (New Zealand)",
      regex: /\b(?:new zealand|nz|auckland|wellington|christchurch|hamilton nz|tauranga)\b|뉴질랜드/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:new zealand|nz|auckland|wellington|christchurch|뉴질랜드)/i,
    },

    // 6. 아프리카 (Africa)
    {
      label: "케냐 (Kenya)",
      regex: /\b(?:kenya|kenyan|nairobi|mombasa|kisumu|nakuru)\b|케냐|나이로비/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:kenya|kenyan market|nairobi|mombasa|케냐|나이로비)/i,
    },
    {
      label: "남아프리카공화국 (South Africa)",
      regex: /\b(?:south africa|south african|johannesburg|cape town|durban|pretoria|port elizabeth)\b|남아프리카|남아공/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:south africa|south african market|johannesburg|cape town|durban|남아공)/i,
    },
    {
      label: "나이지리아 (Nigeria)",
      regex: /\b(?:nigeria|nigerian|lagos|abuja|port harcourt|kano|ibadan)\b|나이지리아/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:nigeria|nigerian market|lagos|abuja|나이지리아)/i,
    },
    {
      label: "이집트 (Egypt)",
      regex: /\b(?:egypt|egyptian|cairo|alexandria|giza|sharm el sheikh)\b|이집트/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:egypt|egyptian market|cairo|alexandria|이집트)/i,
    },
    {
      label: "가나 (Ghana)",
      regex: /\b(?:ghana|ghanaian|accra|kumasi|tema)\b|가나/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:ghana|accra|가나)/i,
    },
    {
      label: "모로코 (Morocco)",
      regex: /\b(?:morocco|moroccan|casablanca|rabat|marrakech|tangier|fes)\b|모로코/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:morocco|moroccan market|casablanca|rabat|marrakech|모로코)/i,
    },
    {
      label: "탄자니아 (Tanzania)",
      regex: /\b(?:tanzania|tanzanian|dar es salaam|zanzibar|dodoma)\b|탄자니아/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:tanzania|dar es salaam|탄자니아)/i,
    },

    // 7. 중남미 (Latin America)
    {
      label: "브라질 (Brazil)",
      regex: /\b(?:brazil|brazilian|brasil|sao paulo|são paulo|rio de janeiro|brasilia|salvador|curitiba|fortaleza)\b|브라질/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:brazil|brazilian market|sao paulo|rio de janeiro|brasilia|브라질)/i,
    },
    {
      label: "아르헨티나 (Argentina)",
      regex: /\b(?:argentina|argentine|buenos aires|cordoba|rosario|mendoza)\b|아르헨티나/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:argentina|argentine market|buenos aires|아르헨티나)/i,
    },
    {
      label: "칠레 (Chile)",
      regex: /\b(?:chile|chilean|santiago|valparaiso|concepcion)\b|칠레/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:chile|chilean market|santiago|칠레)/i,
    },
    {
      label: "콜롬비아 (Colombia)",
      regex: /\b(?:colombia|colombian|bogota|bogotá|medellin|medellín|cali|barranquilla)\b|콜롬비아/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:colombia|colombian market|bogota|medellin|콜롬비아)/i,
    },
    {
      label: "페루 (Peru)",
      regex: /\b(?:peru|peruvian|lima|arequipa|trujillo|cusco)\b|페루/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:peru|peruvian market|lima|페루)/i,
    },
    {
      label: "푸에르토리코 (Puerto Rico)",
      regex: /\b(?:puerto rico|san juan|ponce|bayamon)\b|푸에르토리코/i,
      contextRegex: /(?:shipping to|ship to|deliver to|delivery to|destination:?|based in|located in|office in|market in|in the|for the)\s+(?:the\s+)?(?:puerto rico|san juan|푸에르토리코)/i,
    },
  ];

  // 1단계: 명시적 문맥(배송지, 소재지, 타겟 시장 등) 우선 매칭
  for (const rule of COUNTRY_RULES) {
    if (rule.contextRegex.test(text)) {
      return rule.label;
    }
  }

  // 2단계: 전체 텍스트 내 국가/주/도시 키워드 일반 매칭
  for (const rule of COUNTRY_RULES) {
    if (rule.regex.test(text)) {
      return rule.label;
    }
  }

  return "";
}

/**
 * 본문 및 발신자 정보로부터 바이어 기본 정보(이름, 브랜드명, 국가)를 일괄 추출한다.
 */
export function extractBuyerInfoFromMessage(
  bodyText?: string | null,
  fromName?: string | null,
  email?: string | null,
): { name: string; brandName: string; country: string } {
  return {
    name: extractBuyerNameFromBody(bodyText, fromName || undefined),
    brandName: extractBrandNameFromBody(bodyText, email || undefined),
    country: extractCountryFromBody(bodyText),
  };
}
