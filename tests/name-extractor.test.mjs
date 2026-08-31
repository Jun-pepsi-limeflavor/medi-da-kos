import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  extractBuyerNameFromBody,
  extractBrandNameFromBody,
  extractCountryFromBody,
  extractBuyerInfoFromMessage,
} from "../src/lib/name-extractor.ts";

describe("extractBuyerNameFromBody", () => {
  test("영문 서명(Sign-off)에서 이름 추출", () => {
    const body = "Hi, we want 5000 units of serum.\n\nBest regards,\nJohn Doe\nAcme Corp";
    assert.equal(extractBuyerNameFromBody(body), "John Doe");
  });

  test("영문 단일 이름 서명 추출", () => {
    const body = "Could you please send the quotation for 10k bottles?\n\nThanks,\nSarah";
    assert.equal(extractBuyerNameFromBody(body), "Sarah");
  });

  test("영문 자기소개(Intro)에서 이름 추출", () => {
    const body = "Hello, my name is Sarah Connor and I am looking for OEM toner.";
    assert.equal(extractBuyerNameFromBody(body), "Sarah Connor");
  });

  test("영문 This is [Name] 소개에서 이름 추출", () => {
    const body = "Hello Medidakos team, this is David Miller from GloSkin.";
    assert.equal(extractBuyerNameFromBody(body), "David Miller");
  });

  test("국문 자기소개에서 이름 추출", () => {
    const body1 = "안녕하세요, 뷰티코스메틱의 홍길동 팀장입니다. 수분크림 OEM 견적 문의드립니다.";
    assert.equal(extractBuyerNameFromBody(body1), "홍길동");
  });

  test("국문 서명(드림/올림)에서 이름 추출", () => {
    const body = "수분 세럼 MOQ 문의드립니다.\n\n김철수 드림";
    assert.equal(extractBuyerNameFromBody(body), "김철수");
  });

  test("패턴이 없는 경우 공란 또는 fallback 반환", () => {
    const body = "Please send catalogue and price list.";
    assert.equal(extractBuyerNameFromBody(body), "");
    assert.equal(extractBuyerNameFromBody(body, "Fallback Name"), "Fallback Name");
  });

  test("빈 텍스트나 undefined 처리", () => {
    assert.equal(extractBuyerNameFromBody(""), "");
    assert.equal(extractBuyerNameFromBody(undefined, "Default"), "Default");
  });
});

describe("extractBrandNameFromBody", () => {
  test("from [Brand] 패턴에서 브랜드 추출", () => {
    const body = "Hi, I'm Nicole Erickson from Pink Sky Consulting looking for OEM skincare.";
    assert.equal(extractBrandNameFromBody(body), "Pink Sky Consulting");
  });

  test("founder of [Brand] 패턴에서 브랜드 추출", () => {
    const body = "My name is Carissa Sabater, founder of MAISON CELDORA.";
    assert.equal(extractBrandNameFromBody(body), "MAISON CELDORA");
  });

  test("representing [Brand] 패턴에서 브랜드 추출", () => {
    const body = "This is Charity Kobia representing TJ perfumes based in Nairobi.";
    assert.equal(extractBrandNameFromBody(body), "TJ perfumes");
  });

  test("Our brand is [Brand] 패턴에서 브랜드 추출", () => {
    const body = "We are launching next month and our brand is LUNAVI.";
    assert.equal(extractBrandNameFromBody(body), "LUNAVI");
  });

  test("서명 블록 내 회사 접미사 패턴에서 브랜드 추출", () => {
    const body = "Best regards,\nDaniel Kim\nDivision Twenty Skincare\nLos Angeles, USA";
    assert.equal(extractBrandNameFromBody(body), "Division Twenty Skincare");
  });

  test("이메일 도메인 fallback", () => {
    const body = "Hello, we want to produce 5,000 units of custom serum.";
    assert.equal(extractBrandNameFromBody(body, "contact@bhrskincare.com"), "Bhrskincare");
    assert.equal(extractBrandNameFromBody(body, "hello@glassfxskin.com"), "Glassfxskin");
    assert.equal(extractBrandNameFromBody(body, "info@beautybycharai.nl"), "Beautybycharai");
  });

  test("일반 웹메일 도메인은 fallback 하지 않음", () => {
    const body = "Hello, please quote 10k bottles.";
    assert.equal(extractBrandNameFromBody(body, "user123@gmail.com"), "");
    assert.equal(extractBrandNameFromBody(body, "buyer@naver.com"), "");
  });
});

describe("extractCountryFromBody", () => {
  test("명시적 배송지/소재지 문맥에서 국가 추출", () => {
    const usBody = "Please calculate shipping to Myrtle Beach, SC 29577, United States.";
    assert.equal(extractCountryFromBody(usBody), "미국 (USA)");

    const inBody = "Delivery address: Flat-305, Sai Shiva Towers, Hyderabad, Telangana State, India.";
    assert.equal(extractCountryFromBody(inBody), "인도 (India)");

    const pkBody = "We are planning to launch these products for the Pakistani market.";
    assert.equal(extractCountryFromBody(pkBody), "파키스탄 (Pakistan)");

    const saBody = "Destination warehouse in Riyadh, Saudi Arabia.";
    assert.equal(extractCountryFromBody(saBody), "사우디아라비아 (Saudi Arabia)");

    const keBody = "Shipping to Nairobi, Kenya P.O. Box 3932.";
    assert.equal(extractCountryFromBody(keBody), "케냐 (Kenya)");

    const auBody = "Ship to Penrith, Australia for Golden Veil Eye Cream.";
    assert.equal(extractCountryFromBody(auBody), "호주 (Australia)");

    const caBody = "Based in Toronto, Canada with retail distribution.";
    assert.equal(extractCountryFromBody(caBody), "캐나다 (Canada)");
  });

  test("본문 내 단독 국가 키워드 매칭", () => {
    assert.equal(extractCountryFromBody("We are a cosmetics brand in Netherlands."), "네덜란드 (Netherlands)");
    assert.equal(extractCountryFromBody("Seeking OEM factory for France."), "프랑스 (France)");
    assert.equal(extractCountryFromBody("일본 도쿄 소재 브랜드입니다."), "일본 (Japan)");
  });

  test("국가 언급이 없는 경우 빈 문자열 반환", () => {
    assert.equal(extractCountryFromBody("Can you send sample bottles of 30ml serum?"), "");
  });
});

describe("extractBuyerInfoFromMessage (46 Comprehensive Global Customer Cases)", () => {
  // --- 1. Notion CRM Real Customer Cases (1 ~ 8) ---
  test("Case 1: Nicole Erickson (Pink Sky Consulting / US)", () => {
    const body = `Hello Medidakos team,\n\nI am Nicole Erickson with Pink Sky Consulting representing epi.logic.\nWe are based in Los Angeles, California, United States and looking to produce 5,000 units of custom serum.\n\nBest regards,\nNicole Erickson`;
    const res = extractBuyerInfoFromMessage(body, "Nicole Erickson", "nicole@pinkskyconsulting.com");
    assert.equal(res.name, "Nicole Erickson");
    assert.equal(res.brandName, "Pink Sky Consulting");
    assert.equal(res.country, "미국 (USA)");
  });

  test("Case 2: Carissa Sabater (MAISON CELDORA / US)", () => {
    const body = `My name is Carissa Sabater, founder of MAISON CELDORA based in California.\nWe need quotes for luxury skincare packaging.`;
    const res = extractBuyerInfoFromMessage(body, undefined, "carissa@themaisonceldora.com");
    assert.equal(res.name, "Carissa Sabater");
    assert.equal(res.brandName, "MAISON CELDORA");
    assert.equal(res.country, "미국 (USA)");
  });

  test("Case 3: Bala Pinnamaneni (India)", () => {
    const body = `Hi, this is Bala Pinnamaneni.\nWe are looking for Rice Ceramide Lip Treatment SPF 15 for the Indian market.\nDelivery address: Hyderabad, Telangana State, PIN 500073, India.\n\nThanks,\nBala`;
    const res = extractBuyerInfoFromMessage(body, "Bala Pinnamaneni", "balupinnamaneni@gmail.com");
    assert.equal(res.name, "Bala Pinnamaneni");
    assert.equal(res.country, "인도 (India)");
  });

  test("Case 4: Fatima (Pakistan)", () => {
    const body = `Dear team,\nI am Fatima and sharing our plans for skincare production for the Pakistani market.\nWe would need shipping to Karachi, Pakistan.\n\nBest regards,\nFatima`;
    const res = extractBuyerInfoFromMessage(body, "Fatima", "fatima@gmail.com");
    assert.equal(res.name, "Fatima");
    assert.equal(res.country, "파키스탄 (Pakistan)");
  });

  test("Case 5: Charity Kobia (TJ perfumes / Kenya)", () => {
    const body = `Hello, I am Charity Kobia representing TJ perfumes.\nWe are looking to develop solid perfume samples to ship to Nairobi, Kenya.`;
    const res = extractBuyerInfoFromMessage(body, "Charity Kobia", "candykobia@gmail.com");
    assert.equal(res.name, "Charity Kobia");
    assert.equal(res.brandName, "TJ perfumes");
    assert.equal(res.country, "케냐 (Kenya)");
  });

  test("Case 6: Deem Alsaif (Saudi Arabia)", () => {
    const body = `Hello,\nMy name is Deem Alsaif. We need 1,000 units of eye patches.\nShipping address: Riyadh, Saudi Arabia.\nCertifications required: Halal, ISO 22716 GMP.\n\nBest regards,\nDeem Alsaif`;
    const res = extractBuyerInfoFromMessage(body, "Deem Alsaif", "deem@gmail.com");
    assert.equal(res.name, "Deem Alsaif");
    assert.equal(res.country, "사우디아라비아 (Saudi Arabia)");
  });

  test("Case 7: Chhavi Kumar (La Maison Roselle / Canada)", () => {
    const body = `Hello, this is Chhavi Kumar from La Maison Roselle in Toronto, Canada.\nWe would like to request skincare samples.`;
    const res = extractBuyerInfoFromMessage(body, "Chhavi Kumar", "chhavi.kumar19@gmail.com");
    assert.equal(res.name, "Chhavi Kumar");
    assert.equal(res.brandName, "La Maison Roselle");
    assert.equal(res.country, "캐나다 (Canada)");
  });

  test("Case 8: BHR Skincare (US - South Carolina Zip)", () => {
    const body = `Inquiry for private label cleanser.\nDelivery warehouse: 4890 Luster Leaf Circle, Myrtle Beach, SC 29577.\n\nThanks,\nBHR Skincare`;
    const res = extractBuyerInfoFromMessage(body, undefined, "contact@bhrskincare.com");
    assert.equal(res.brandName, "BHR Skincare");
    assert.equal(res.country, "미국 (USA)");
  });

  // --- 2. North America Cases (9 ~ 16) ---
  test("Case 9: David Miller (GloSkin Labs / US - California)", () => {
    const body = `Hello,\nThis is David Miller from GloSkin Labs.\nWe are looking to manufacture 5,000 units of niacinamide serum in Los Angeles, California.`;
    const res = extractBuyerInfoFromMessage(body, "David Miller", "david@gloskinlabs.com");
    assert.equal(res.name, "David Miller");
    assert.equal(res.brandName, "GloSkin Labs");
    assert.equal(res.country, "미국 (USA)");
  });

  test("Case 10: Amanda Hayes (Pacific Botanicals Inc. / US - Seattle, WA)", () => {
    const body = `Hi Medi Da Kos,\n\nWe are looking for OEM sunscreen suppliers. Shipping to Seattle, Washington.\n\nSincerely,\nAmanda Hayes\nPacific Botanicals Inc.`;
    const res = extractBuyerInfoFromMessage(body, "Amanda Hayes", "amanda@pacificbotanicals.com");
    assert.equal(res.name, "Amanda Hayes");
    assert.equal(res.brandName, "Pacific Botanicals Inc");
    assert.equal(res.country, "미국 (USA)");
  });

  test("Case 11: Brandon Scott (Scott Skincare LLC / US - Austin, Texas)", () => {
    const body = `Hello, I'm Brandon Scott, owner of Scott Skincare LLC located in Austin, Texas.`;
    const res = extractBuyerInfoFromMessage(body, "Brandon Scott", "brandon@scottskincare.com");
    assert.equal(res.name, "Brandon Scott");
    assert.equal(res.brandName, "Scott Skincare LLC");
    assert.equal(res.country, "미국 (USA)");
  });

  test("Case 12: Emily Watson (PureAura Beauty / US - Miami, Florida)", () => {
    const body = `Dear team,\nOur brand is PureAura Beauty. We require freight delivery to Miami, Florida.`;
    const res = extractBuyerInfoFromMessage(body, "Emily Watson", "emily@pureaurabeauty.com");
    assert.equal(res.name, "Emily Watson");
    assert.equal(res.brandName, "PureAura Beauty");
    assert.equal(res.country, "미국 (USA)");
  });

  test("Case 13: Jean-Luc Roy (Montreal Derma Labs / Canada - Quebec)", () => {
    const body = `Bonjour,\nThis is Jean-Luc Roy representing Montreal Derma Labs in Montreal, Quebec, Canada.`;
    const res = extractBuyerInfoFromMessage(body, "Jean-Luc Roy", "jlroy@montrealderma.ca");
    assert.equal(res.name, "Jean-Luc Roy");
    assert.equal(res.brandName, "Montreal Derma Labs");
    assert.equal(res.country, "캐나다 (Canada)");
  });

  test("Case 14: Samantha Lee (Vancouver Organic Skincare / Canada - BC)", () => {
    const body = `Hi,\nMy name is Samantha Lee from Vancouver Organic Skincare.\nPlease quote for shipping to Vancouver, British Columbia.`;
    const res = extractBuyerInfoFromMessage(body, "Samantha Lee", "sam@vancouverorganics.ca");
    assert.equal(res.name, "Samantha Lee");
    assert.equal(res.brandName, "Vancouver Organic Skincare");
    assert.equal(res.country, "캐나다 (Canada)");
  });

  test("Case 15: Carlos Mendez (Botanica Solar S.A. / Mexico - Guadalajara)", () => {
    const body = `Hola,\nI am Carlos Mendez with Botanica Solar S.A. based in Guadalajara, Mexico.`;
    const res = extractBuyerInfoFromMessage(body, "Carlos Mendez", "carlos@botanicasolar.mx");
    assert.equal(res.name, "Carlos Mendez");
    assert.equal(res.brandName, "Botanica Solar S.A.");
    assert.equal(res.country, "멕시코 (Mexico)");
  });

  test("Case 16: Isabella Rivera (Caribe Glow / Puerto Rico - San Juan)", () => {
    const body = `Hello,\nThis is Isabella Rivera from Caribe Glow in San Juan, Puerto Rico.\nWe need sample sunscreens.`;
    const res = extractBuyerInfoFromMessage(body, "Isabella Rivera", "isabella@caribeglow.com");
    assert.equal(res.name, "Isabella Rivera");
    assert.equal(res.brandName, "Caribe Glow");
    assert.equal(res.country, "푸에르토리코 (Puerto Rico)");
  });

  // --- 3. Europe Cases (17 ~ 26) ---
  test("Case 17: Oliver Taylor (London Aesthetic Group / UK - London)", () => {
    const body = `Dear Medi Da Kos,\n\nWe are looking to develop private label hyaluronic serum for the UK market.\n\nKind regards,\nOliver Taylor\nLondon Aesthetic Group`;
    const res = extractBuyerInfoFromMessage(body, "Oliver Taylor", "oliver@londonaesthetic.co.uk");
    assert.equal(res.name, "Oliver Taylor");
    assert.equal(res.brandName, "London Aesthetic Group");
    assert.equal(res.country, "영국 (UK)");
  });

  test("Case 18: Charlotte Davies (Davies Cosmetics Ltd / UK - Manchester)", () => {
    const body = `Hello,\nMy name is Charlotte Davies from Davies Cosmetics Ltd.\nShipment to Manchester, United Kingdom.`;
    const res = extractBuyerInfoFromMessage(body, "Charlotte Davies", "charlotte@daviescosmetics.co.uk");
    assert.equal(res.name, "Charlotte Davies");
    assert.equal(res.brandName, "Davies Cosmetics Ltd");
    assert.equal(res.country, "영국 (UK)");
  });

  test("Case 19: Pierre Dubois (Lumiere Paris / France - Paris)", () => {
    const body = `Bonjour,\nI am Pierre Dubois, founder of Lumiere Paris based in Paris, France.`;
    const res = extractBuyerInfoFromMessage(body, "Pierre Dubois", "pierre@lumiereparis.fr");
    assert.equal(res.name, "Pierre Dubois");
    assert.equal(res.brandName, "Lumiere Paris");
    assert.equal(res.country, "프랑스 (France)");
  });

  test("Case 20: Hans Schmidt (Schmidt Kosmetik GmbH / Germany - Berlin)", () => {
    const body = `Guten Tag,\nThis is Hans Schmidt representing Schmidt Kosmetik GmbH in Berlin, Germany.`;
    const res = extractBuyerInfoFromMessage(body, "Hans Schmidt", "h.schmidt@schmidt-kosmetik.de");
    assert.equal(res.name, "Hans Schmidt");
    assert.equal(res.brandName, "Schmidt Kosmetik GmbH");
    assert.equal(res.country, "독일 (Germany)");
  });

  test("Case 21: Jan de Vries (De Vries BioCare B.V. / Netherlands - Amsterdam)", () => {
    const body = `Hello,\nMy name is Jan de Vries with De Vries BioCare B.V. located in Amsterdam, Netherlands.`;
    const res = extractBuyerInfoFromMessage(body, "Jan de Vries", "jan@devriesbiocare.nl");
    assert.equal(res.name, "Jan de Vries");
    assert.equal(res.brandName, "De Vries BioCare B.V.");
    assert.equal(res.country, "네덜란드 (Netherlands)");
  });

  test("Case 22: Marco Rossi (Rossi Milano S.r.l. / Italy - Milan)", () => {
    const body = `Ciao,\nThis is Marco Rossi from Rossi Milano S.r.l.\nPlease calculate air freight to Milan, Italy.`;
    const res = extractBuyerInfoFromMessage(body, "Marco Rossi", "m.rossi@rossimilano.it");
    assert.equal(res.name, "Marco Rossi");
    assert.equal(res.brandName, "Rossi Milano S.r.l.");
    assert.equal(res.country, "이탈리아 (Italy)");
  });

  test("Case 23: Elena Gomez (Iberia Naturals S.A. / Spain - Barcelona)", () => {
    const body = `Hola,\nI'm Elena Gomez from Iberia Naturals S.A. in Barcelona, Spain.`;
    const res = extractBuyerInfoFromMessage(body, "Elena Gomez", "elena@iberianaturals.es");
    assert.equal(res.name, "Elena Gomez");
    assert.equal(res.brandName, "Iberia Naturals S.A.");
    assert.equal(res.country, "스페인 (Spain)");
  });

  test("Case 24: Lukas Weber (Alpine Derma AG / Switzerland - Zurich)", () => {
    const body = `Hello,\nThis is Lukas Weber representing Alpine Derma AG based in Zurich, Switzerland.`;
    const res = extractBuyerInfoFromMessage(body, "Lukas Weber", "l.weber@alpinederma.ch");
    assert.equal(res.name, "Lukas Weber");
    assert.equal(res.brandName, "Alpine Derma AG");
    assert.equal(res.country, "스위스 (Switzerland)");
  });

  test("Case 25: Astrid Lindgren (Nordic Glow Beauty / Sweden - Stockholm)", () => {
    const body = `Hej,\nMy name is Astrid Lindgren from Nordic Glow Beauty in Stockholm, Sweden.`;
    const res = extractBuyerInfoFromMessage(body, "Astrid Lindgren", "astrid@nordicglow.se");
    assert.equal(res.name, "Astrid Lindgren");
    assert.equal(res.brandName, "Nordic Glow Beauty");
    assert.equal(res.country, "스웨덴 (Sweden)");
  });

  test("Case 26: Jakub Kowalski (Polsko Pharma / Poland - Warsaw)", () => {
    const body = `Dzien dobry,\nThis is Jakub Kowalski representing Polsko Pharma.\nDelivery warehouse in Warsaw, Poland.`;
    const res = extractBuyerInfoFromMessage(body, "Jakub Kowalski", "j.kowalski@polskopharma.pl");
    assert.equal(res.name, "Jakub Kowalski");
    assert.equal(res.brandName, "Polsko Pharma");
    assert.equal(res.country, "폴란드 (Poland)");
  });

  // --- 4. Asia-Pacific Cases (27 ~ 36) ---
  test("Case 27: Kenji Sato (Kyoto Botanicals Ltd / Japan - Tokyo)", () => {
    const body = `Konnichiwa,\nI am Kenji Sato with Kyoto Botanicals Ltd.\nWe plan to import 10,000 sheet masks to Tokyo, Japan.`;
    const res = extractBuyerInfoFromMessage(body, "Kenji Sato", "sato@kyotobotanicals.co.jp");
    assert.equal(res.name, "Kenji Sato");
    assert.equal(res.brandName, "Kyoto Botanicals Ltd");
    assert.equal(res.country, "일본 (Japan)");
  });

  test("Case 28: Tan Wei Ling (GlowHaven / Singapore)", () => {
    const body = `Dear Medi Da Kos,\n\nI'm Tan Wei Ling and our brand is GlowHaven.\nCustomized sun stick formulations for the Singapore market.\n\nWarm regards,\nTan Wei Ling`;
    const res = extractBuyerInfoFromMessage(body, "Tan Wei Ling", "weiling.tan@gmail.com");
    assert.equal(res.name, "Tan Wei Ling");
    assert.equal(res.brandName, "GlowHaven");
    assert.equal(res.country, "싱가포르 (Singapore)");
  });

  test("Case 29: Nurul Huda (Seri Beauty Sdn Bhd / Malaysia - KL)", () => {
    const body = `Salam,\nMy name is Nurul Huda from Seri Beauty Sdn Bhd located in Kuala Lumpur, Malaysia.`;
    const res = extractBuyerInfoFromMessage(body, "Nurul Huda", "nurul@seribeauty.my");
    assert.equal(res.name, "Nurul Huda");
    assert.equal(res.brandName, "Seri Beauty Sdn Bhd");
    assert.equal(res.country, "말레이시아 (Malaysia)");
  });

  test("Case 30: Nguyen Van Minh (Saigon Pure Herb / Vietnam - Ho Chi Minh)", () => {
    const body = `Xin chao,\nThis is Nguyen Van Minh representing Saigon Pure Herb in Ho Chi Minh, Vietnam.`;
    const res = extractBuyerInfoFromMessage(body, "Nguyen Van Minh", "minh@saigonpureherb.vn");
    assert.equal(res.name, "Nguyen Van Minh");
    assert.equal(res.brandName, "Saigon Pure Herb");
    assert.equal(res.country, "베트남 (Vietnam)");
  });

  test("Case 31: Somchai Prasert (Siam Herbal Labs / Thailand - Bangkok)", () => {
    const body = `Sawasdee,\nI am Somchai Prasert from Siam Herbal Labs based in Bangkok, Thailand.`;
    const res = extractBuyerInfoFromMessage(body, "Somchai Prasert", "somchai@siamherballabs.co.th");
    assert.equal(res.name, "Somchai Prasert");
    assert.equal(res.brandName, "Siam Herbal Labs");
    assert.equal(res.country, "태국 (Thailand)");
  });

  test("Case 32: Budi Santoso (Nusantara Botanica / Indonesia - Jakarta)", () => {
    const body = `Halo,\nThis is Budi Santoso with Nusantara Botanica.\nShipping destination: Jakarta, Indonesia.`;
    const res = extractBuyerInfoFromMessage(body, "Budi Santoso", "budi@nusantarabotanica.co.id");
    assert.equal(res.name, "Budi Santoso");
    assert.equal(res.brandName, "Nusantara Botanica");
    assert.equal(res.country, "인도네시아 (Indonesia)");
  });

  test("Case 33: Maria Santos (Manila Derma Care / Philippines - Manila)", () => {
    const body = `Hello,\nMy name is Maria Santos, founder of Manila Derma Care in Manila, Philippines.`;
    const res = extractBuyerInfoFromMessage(body, "Maria Santos", "maria@maniladermacare.ph");
    assert.equal(res.name, "Maria Santos");
    assert.equal(res.brandName, "Manila Derma Care");
    assert.equal(res.country, "필리핀 (Philippines)");
  });

  test("Case 34: Chen Wei (Formosa Cosmetics / Taiwan - Taipei)", () => {
    const body = `Ni hao,\nThis is Chen Wei from Formosa Cosmetics located in Taipei, Taiwan.`;
    const res = extractBuyerInfoFromMessage(body, "Chen Wei", "chenwei@formosacosmetics.tw");
    assert.equal(res.name, "Chen Wei");
    assert.equal(res.brandName, "Formosa Cosmetics");
    assert.equal(res.country, "대만 (Taiwan)");
  });

  test("Case 35: Liam Hemsworth (Aura Botanicals LLC / Australia - Sydney)", () => {
    const body = `Hi Medi Da Kos team,\n\nWe need 3,000 units of ceramide barrier cream. Our warehouse is based in Sydney, Australia.\n\nBest regards,\nLiam Hemsworth\nAura Botanicals LLC`;
    const res = extractBuyerInfoFromMessage(body, undefined, "liam@aurabotanicals.com");
    assert.equal(res.name, "Liam Hemsworth");
    assert.equal(res.brandName, "Aura Botanicals LLC");
    assert.equal(res.country, "호주 (Australia)");
  });

  test("Case 36: James Wilson (Aotearoa Skincare Ltd / New Zealand - Auckland)", () => {
    const body = `Kia ora,\nI am James Wilson representing Aotearoa Skincare Ltd in Auckland, New Zealand.`;
    const res = extractBuyerInfoFromMessage(body, "James Wilson", "james@aotearoaskincare.nz");
    assert.equal(res.name, "James Wilson");
    assert.equal(res.brandName, "Aotearoa Skincare Ltd");
    assert.equal(res.country, "뉴질랜드 (New Zealand)");
  });

  // --- 5. Middle East & Africa Cases (37 ~ 42) ---
  test("Case 37: Tariq Al-Mansoor (Luxe Orient Skincare / UAE - Dubai)", () => {
    const body = `Greetings,\n\nThis is Tariq Al-Mansoor representing Luxe Orient Skincare. We are looking for high-end anti-aging essence with peptide complexes.\nInitial order volume would be 5,000 units. Please calculate air freight shipping to Dubai, United Arab Emirates.\n\nSincerely,\nTariq Al-Mansoor`;
    const res = extractBuyerInfoFromMessage(body, "Tariq Al-Mansoor", "tariq@luxeorient.ae");
    assert.equal(res.name, "Tariq Al-Mansoor");
    assert.equal(res.brandName, "Luxe Orient Skincare");
    assert.equal(res.country, "아랍에미리트 (UAE)");
  });

  test("Case 38: Abdullah Al-Ghamdi (Desert Pearl Organics / Saudi Arabia - Jeddah)", () => {
    const body = `Salam,\nI am Abdullah Al-Ghamdi, CEO of Desert Pearl Organics based in Jeddah, Saudi Arabia.`;
    const res = extractBuyerInfoFromMessage(body, "Abdullah Al-Ghamdi", "abdullah@desertpearl.sa");
    assert.equal(res.name, "Abdullah Al-Ghamdi");
    assert.equal(res.brandName, "Desert Pearl Organics");
    assert.equal(res.country, "사우디아라비아 (Saudi Arabia)");
  });

  test("Case 39: Youssef Mansour (Nile Glow Pharma / Egypt - Cairo)", () => {
    const body = `Hello,\nThis is Youssef Mansour from Nile Glow Pharma in Cairo, Egypt.`;
    const res = extractBuyerInfoFromMessage(body, "Youssef Mansour", "youssef@nileglow.eg");
    assert.equal(res.name, "Youssef Mansour");
    assert.equal(res.brandName, "Nile Glow Pharma");
    assert.equal(res.country, "이집트 (Egypt)");
  });

  test("Case 40: Zanele Khumalo (Ubuntu Natural Beauty Pty Ltd / South Africa - Johannesburg)", () => {
    const body = `Hi,\nMy name is Zanele Khumalo with Ubuntu Natural Beauty Pty Ltd based in Johannesburg, South Africa.`;
    const res = extractBuyerInfoFromMessage(body, "Zanele Khumalo", "zanele@ubuntubeauty.co.za");
    assert.equal(res.name, "Zanele Khumalo");
    assert.equal(res.brandName, "Ubuntu Natural Beauty Pty Ltd");
    assert.equal(res.country, "남아프리카공화국 (South Africa)");
  });

  test("Case 41: Kwame Mensah (Gold Coast Shea Labs / Ghana - Accra)", () => {
    const body = `Greetings,\nThis is Kwame Mensah from Gold Coast Shea Labs.\nShipping to Accra, Ghana.`;
    const res = extractBuyerInfoFromMessage(body, "Kwame Mensah", "kwame@goldcoastshea.gh");
    assert.equal(res.name, "Kwame Mensah");
    assert.equal(res.brandName, "Gold Coast Shea Labs");
    assert.equal(res.country, "가나 (Ghana)");
  });

  test("Case 42: Leila Benali (Atlas Argan S.A.R.L. / Morocco - Casablanca)", () => {
    const body = `Bonjour,\nI am Leila Benali representing Atlas Argan in Casablanca, Morocco.`;
    const res = extractBuyerInfoFromMessage(body, "Leila Benali", "leila@atlasargan.ma");
    assert.equal(res.name, "Leila Benali");
    assert.equal(res.brandName, "Atlas Argan");
    assert.equal(res.country, "모로코 (Morocco)");
  });

  // --- 6. Domestic Korea & Edge Cases (43 ~ 46) ---
  test("Case 43: 박지훈 (네이처글로우 / Korea)", () => {
    const body = `안녕하세요, 네이처글로우의 박지훈 팀장입니다.\n수분 진정 토너 5,000개 ODM 견적 및 샘플 발송 일정 문의드립니다.\n감사합니다.\n\n박지훈 드림`;
    const res = extractBuyerInfoFromMessage(body, "박지훈", "jihun.park@natureglow.co.kr");
    assert.equal(res.name, "박지훈");
    assert.equal(res.brandName, "네이처글로우");
  });

  test("Case 44: 이민수 (주식회사 바이오스킨 / Korea)", () => {
    const body = `주식회사 바이오스킨의 이민수 대표입니다.\n선스틱 OEM 견적 요청합니다.`;
    const res = extractBuyerInfoFromMessage(body, "이민수", "ms.lee@bioskin.co.kr");
    assert.equal(res.name, "이민수");
    assert.equal(res.brandName, "바이오스킨");
  });

  test("Case 45: Anonymous Buyer (Domain fallback: velvetglowskin.com / Country: UK London)", () => {
    const body = `Hello,\nWe are looking to order 2,000 units of retinal night cream.\nPlease calculate express courier shipping to London, UK.`;
    const res = extractBuyerInfoFromMessage(body, undefined, "info@velvetglowskin.com");
    assert.equal(res.brandName, "Velvetglowskin");
    assert.equal(res.country, "영국 (UK)");
  });

  test("Case 46: Marie-Claire Dupont (Parisienne Botanique / France)", () => {
    const body = `Chere equipe,\nThis is Marie-Claire Dupont from Parisienne Botanique in Paris, France.`;
    const res = extractBuyerInfoFromMessage(body, "Marie-Claire Dupont", "mc.dupont@parisiennebotanique.fr");
    assert.equal(res.name, "Marie-Claire Dupont");
    assert.equal(res.brandName, "Parisienne Botanique");
    assert.equal(res.country, "프랑스 (France)");
  });
});
