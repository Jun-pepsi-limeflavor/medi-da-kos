# 랜딩 GA4 계측 설계 — catalog·dashboard

**작성일:** 2026-08-30
**대상:** `/landing/catalog`, `/landing/dashboard`
**선행 스펙:** [2026-08-27-landing-catalog-dashboard-ab-spec.md](2026-08-27-landing-catalog-dashboard-ab-spec.md)

> 이 문서는 위 스펙의 **`## Measurement` 절을 대체한다.** 나머지 절(폼 필드, Firestore 문서, 내부 메일, 수용 기준)은 그대로 유효하다.
> `/landing/korea`는 이번 범위 밖이다. 다만 §3에서 korea의 신호 수집 로직을 공용화하므로 korea의 이벤트 발화는 **변하지 않아야 한다**.

## 왜 다시 쓰는가

08-28 랜딩 개편(`landingRequests` 단일화)에서 화면은 새로 만들었는데 계측이 따라오지 못했다. korea 랜딩엔 `form_abandon`·`cta_view`·`engaged_15s`·`scroll_depth`가 다 있는데 새 랜딩 두 개엔 하나도 없다.

그 결과 지금 답할 수 없는 질문들:

| 알고 싶은 것 | 현재 |
|---|---|
| 장바구니에 담고 연락처 폼까지 갔다가 멈추는 비율 | **측정 불가.** 폼 도달 이벤트가 없다 |
| 대시보드 작성 버튼(`Start Your Product Brief`)을 누르는지 | **측정 불가.** 이벤트가 없다 |
| 브리프를 몇 번째 스텝까지 채우는지 | **반쪽.** `dashboard_step_view`가 `persist()`에서만, 그것도 넘어간 *뒤* 번호로 찍혀 "1단계 열고 이탈"이 구조적으로 0이다 |
| 어떤 상품을 보고 멈추는지 | **반쪽.** 초기 serum 탭 노출 이벤트가 없어 분모가 없다 |
| 폼 어느 칸에서 막히는지 | **측정 불가.** `ConsultationForm`엔 제출 성공 이벤트뿐이다 |

## 결정 사항

- **GTM 컨테이너를 도입하지 않는다.** gtag.js 직접 삽입을 유지한다. 이벤트는 이미 코드로 정의되어 있고, dev와 GA4 관리를 한 사람이 하므로 GTM의 핵심 이득(비개발자의 태그 수정)이 이 조직에 없다. 도입하면 측정 정의가 코드와 콘솔 두 곳으로 갈리는 유지비만 남는다. [[결정 — 데이터 분석 도구는 GA4 유지, PostHog 보류]]와 같은 결.
- **이벤트 이름은 랜딩 간 공유하고 랜딩 고유 행동만 파라미터로 분해한다.** 세 랜딩을 한 보고서에서 나란히 놓고 보는 것이 이번 A/B의 목적이다. 랜딩별 접두사(`catalog_form_start` 같은)를 쓰면 그게 불가능해지고 맞춤 측정기준만 계속 늘어난다.
- **변이 배정은 콜드메일 발송 링크에서 한다.** 브라우저 내 랜덤 배정을 쓰지 않는다(선행 스펙에서 이미 결정). `utm_content=catalog` / `utm_content=dashboard`.

## §1 이벤트 스펙

`landing_variant`와 `is_test`는 헬퍼가 모든 이벤트에 전역으로 붙인다. 개별 발화 지점에서 붙이지 않는다 — 빠뜨린 이벤트 하나가 보고서 전체를 오염시킨다.

### 공용 이벤트

| 이벤트 | 파라미터 | 발화 시점 | catalog | dashboard |
|---|---|---|---|---|
| `scroll_depth` | `percent_scrolled` (25/50/75/100) | 각 임계값 도달 시 1회 | ✓ | — |
| `engaged_15s` | — | 문서가 보이는 상태로 누적 15초 | ✓ | ✓ |
| `cta_view` | `cta_id` | CTA가 화면에 3초 이상 머묾 | ✓ | ✓ |
| `cta_click` | `cta_id` | CTA 클릭 | ✓ | ✓ |
| `form_view` | `form_id` | 연락처 폼이 렌더된 순간 | ✓ | ✓ |
| `form_start` | `form_id` | 폼 첫 입력 | ✓ | ✓ |
| `form_abandon` | `form_id`, `last_field` | 폼 작성 중 이탈 (beacon 전송) | ✓ | ✓ |
| `generate_lead` | `lead_type`, `expected_volume` | Firestore 쓰기 성공 후 | ✓ | ✓ |

**`form_view`가 이번 작업의 핵심이다.** "담아놓고 폼까지 갔다가 멈추는 비율"의 분모이고, 지금 존재하지 않는다.

**dashboard에 `scroll_depth`를 넣지 않는다.** 화면 구성상(히어로 + how-it-works + CTA 하나) 스크롤 도달률이 진단 정보를 주지 않는다. 체류는 GA4 기본 `평균 참여 시간`과 `engaged_15s`로 본다.

**`engaged_15s`의 15초 기준은 korea와 같다.** GA4 기본 참여 세션 기준 10초는 봇이 통과한다. 탭이 숨겨진 동안은 세지 않는다.

**`form_abandon`은 필드 *이름만* 보낸다.** 입력값(이메일·회사명)은 절대 보내지 않는다.

### catalog 전용

| 이벤트 | 파라미터 | 발화 시점 |
|---|---|---|
| `catalog_category_view` | `catalog_category` | 카테고리 탭이 활성화된 순간. **초기 `serum` 노출도 포함** |
| `catalog_product_view` | `product_id`, `catalog_category` | 상품 상세 모달 열기 |
| `catalog_product_select` | `product_id`, `catalog_category`, `cart_size` | 장바구니 담기 |
| `catalog_product_remove` | `product_id`, `cart_size` | 장바구니에서 빼기 |

`cart_size`는 해당 동작 **직후** 담긴 개수다. "몇 개 담고 멈췄나"가 여기서 나온다.

카테고리는 라우트 이동이 아니라 탭 전환이므로 `page_view`가 발생하지 않는다. `catalog_category_view` 없이는 "세럼 말고 다른 카테고리로 넘어갔는지"를 알 방법이 없다.

### dashboard 전용

| 이벤트 | 파라미터 | 발화 시점 |
|---|---|---|
| `brief_step_open` | `brief_step`, `brief_step_label` | 해당 스텝이 화면에 나타난 순간 |
| `brief_step_complete` | `brief_step`, `brief_step_label` | 해당 스텝 저장·진행 성공 |

기존 `dashboard_step_view` 하나를 이 둘로 쪼갠다. "몇 번째까지 채웠나"는 세션별 `brief_step_open`의 **최댓값 분포**로 읽는다. `open`과 `complete`의 차이가 곧 그 스텝에서 막힌 사람이다.

`brief_step_label`은 [src/lib/brief-steps.ts](../../src/lib/brief-steps.ts)의 `getBriefStepLabel()`을 쓴다. 라벨을 새로 정의하지 않는다.

### `cta_id` 값

| 랜딩 | 값 | 대상 |
|---|---|---|
| catalog | `request_consultation` | 하단 트레이의 `Request a consultation` |
| dashboard | `start_brief` | `Start Your Product Brief` |
| dashboard | `scroll_to_form` | 진행 중 배너의 `Scroll to form ↓` |

### 폐기되는 이벤트

| 폐기 | 대체 | 이유 |
|---|---|---|
| `consultation_submit` | `generate_lead { lead_type: "consultation" }` | 구글 권장 리드젠 이벤트 이름을 쓰면 GA4 Lead acquisition 리포트가 자동으로 열린다. 자체 이름은 그 혜택이 없다 |
| `consultation_start` | `catalog_product_select { cart_size: 1 }` | 이름이 실제 뜻과 어긋나 있다. 지금 이 이벤트는 "상담 시작"이 아니라 **첫 상품 담기**에서 발화한다. 폼 도달로 오독하기 쉽다 |
| `dashboard_step_view` | `brief_step_open` + `brief_step_complete` | 위 참조 |

폐기 이벤트의 과거 데이터는 GA4에 남아 있다. 판독 시 절단면(배포일)을 인지한다.

## §2 퍼널 정의

GA4 탐색 → 유입경로 탐색. 랜딩별 1장.

### catalog

| # | 단계 이름 | 조건 |
|---|---|---|
| 1 | 도착 | `page_view` + `page_location` **포함** `/landing/catalog` |
| 2 | 상품 열어봄 | `catalog_product_view` |
| 3 | 담음 | `catalog_product_select` |
| 4 | 폼까지 감 | `form_view` |
| 5 | 쓰기 시작 | `form_start` |
| 6 | 보냄 | `generate_lead` |

### dashboard

| # | 단계 이름 | 조건 |
|---|---|---|
| 1 | 도착 | `page_view` + `page_location` **포함** `/landing/dashboard` |
| 2 | 작성 시작 누름 | `cta_click` + `cta_id` = `start_brief` |
| 3 | 브리프 진입 | `brief_step_open` + `brief_step` = 1 |
| 4 | 절반 넘김 | `brief_step_open` + `brief_step` = 4 |
| 5 | 폼까지 감 | `form_view` |
| 6 | 보냄 | `generate_lead` |

### 판독 규칙 (korea에서 이미 확립된 것)

- **필터는 `테스트 여부` 「일치하지 않음: `true`」로 건다.** `= false`로 걸면 맞춤 측정기준 등록 이전 이벤트가 빈 값이라 통째로 사라진다.
- **분모는 `세션수`를 쓴다. `참여 세션수`가 아니다.** 참여 판정 기준 10초를 봇이 통과하고, `generate_lead`를 핵심 이벤트로 등록하면 리드를 남긴 세션이 자동으로 참여 세션이 되어 분모와 분자가 연동된다. 품질 필터가 필요하면 `engaged_15s`를 쓴다.
- **단계 조건 창에는 「페이지 경로」가 없다.** 이벤트 매개변수만 나온다. 같은 뜻은 `page_location`이고 쿼리를 포함한 전체 주소라 **「포함」**으로 걸어야 한다. 「정확히 일치」로 하면 UTM 붙은 유입이 전부 빠진다.
- **단계 이름은 이벤트가 아니라 사람이 한 행동으로 쓴다.** 조건을 바꾸면 이름도 같이 고친다.
- **만든 날 판독하지 않는다.** 맞춤 측정기준은 등록 당일 이벤트에도 값이 안 붙고 탐색 보고서 반영에 몇 시간 걸린다. 다음 날 「최근 7일」로 연다.

### 끊긴 구간의 해석

| 구간 | 뜻 | 처방 |
|---|---|---|
| catalog 1→2 | 첫 화면에서 나감 | 히어로 문구 또는 유입 미스매치 |
| catalog 2→3 | 봤는데 안 담음 | 상품 구성·상세 정보 |
| catalog 3→4 | 담아놓고 폼에 안 감 | CTA 노출·문구. `cta_view` 대비 `cta_click`으로 노출/문구 판별 |
| catalog 4→5 | 폼 열고 안 씀 | 폼 길이·요구 정보 |
| catalog 5→6 | 쓰다 말았음 | `form_abandon`의 `last_field`로 어느 칸인지 확인 |
| dashboard 1→2 | 작성 버튼을 안 누름 | 히어로·CTA 설득 |
| dashboard 2→3 | 눌렀는데 진입 안 됨 | 기술적 문제 의심 |
| dashboard 3→4 | 초반에 이탈 | 스텝 1~3 질문 부담. `open`/`complete` 차이로 정확한 스텝 특정 |

## §3 코드 변경

파일 6개, 신규 파일 0개.

### 1. [src/lib/analytics.ts](../../src/lib/analytics.ts) — 단일 진입점으로 통합

`trackLandingEvent`를 여기로 흡수하고 `src/lib/landing/analytics.ts`를 삭제한다.

지금 `is_test` 판정이 두 곳에 중복 구현되어 있다 — [src/lib/env-flags.ts](../../src/lib/env-flags.ts)의 `isNonProductionEnv()`와 `src/lib/landing/analytics.ts:13`의 인라인 호스트 비교. 후자를 제거하고 `isNonProductionEnv()` 하나만 남긴다. 판정이 갈리면 어느 쪽이 맞는지 알 수 없다.

**`landing/analytics.ts`의 개인정보 키 차단 필터(`privateKeys`)는 그대로 옮긴다.** GA4로 나가는 값을 거르는 신뢰 경계이고 간소화 대상이 아니다. 통합된 헬퍼가 모든 랜딩 이벤트에 이 필터를 적용해야 한다.

### 2. `src/lib/landing/analytics.ts` — 삭제

### 3. [src/app/landing/korea/KoreaPageSignals.tsx](../../src/app/landing/korea/KoreaPageSignals.tsx) — 랜딩 공용으로 일반화

`scroll_depth`·`engaged_15s`·`cta_view` 관찰 로직은 랜딩과 무관하다. 새 파일을 만들지 말고 이 컴포넌트를 관찰 대상(섹션 셀렉터·CTA 셀렉터)을 props로 받는 형태로 일반화한 뒤 catalog에서 재사용한다.

**korea의 발화 동작은 변하지 않아야 한다.** `section_view`·`faq_open`·`positioning_arm`은 korea 전용으로 남는다.

### 4. [src/components/landing/CatalogLanding.tsx](../../src/components/landing/CatalogLanding.tsx)

- 마운트 시 초기 카테고리(`serum`) `catalog_category_view` 발화
- `Request a consultation`에 `cta_click { cta_id: "request_consultation" }`
- `catalog_product_select`/`catalog_product_remove`에 `cart_size` 추가
- 트레이에서 항목 제거 시 `catalog_product_remove` 발화 (현재 이벤트 없음)
- `consultation_start` 호출과 `hasStartedConsultation` 상태 제거
- 공용 신호 컴포넌트 마운트 (`scroll_depth`·`engaged_15s`·`cta_view`)

### 5. [src/components/landing/ConsultationForm.tsx](../../src/components/landing/ConsultationForm.tsx)

**두 랜딩이 이 폼을 공유하므로 여기 한 곳만 고치면 catalog·dashboard가 동시에 해결된다.**

- 마운트 시 `form_view { form_id: "landing-consultation" }`
- 첫 입력에 `form_start`
- 이탈 시 `form_abandon { last_field }` — beacon 전송, **필드 이름만**
- `consultation_submit` → `generate_lead { lead_type: "consultation", expected_volume }`

### 6. [src/components/dashboard/CMWizard.tsx](../../src/components/dashboard/CMWizard.tsx) + [src/components/landing/LandingDashboardHeader.tsx](../../src/components/landing/LandingDashboardHeader.tsx)

- `Start Your Product Brief`에 `cta_click { cta_id: "start_brief" }`
- `Scroll to form ↓`에 `cta_click { cta_id: "scroll_to_form" }`
- 스텝 렌더 시 `brief_step_open` (`persist()`가 아니라 스텝 전환 이펙트에서)
- `persist(advance=true)` 성공 시 `brief_step_complete`
- 기존 `dashboard_step_view` 호출 제거
- `mode === "consultation"`일 때만 발화한다. 로그인 대시보드(`mode === "order"`)의 계측은 이번 범위가 아니다

## §4 GA4 콘솔 등록 — **배포보다 먼저**

맞춤 측정기준은 **등록 시점부터의 데이터만 채워지고 소급이 안 된다.** 코드를 먼저 배포하면 그 사이 데이터를 영구히 잃는다. 08-06에 같은 실수가 있었다.

### 신규 등록 (전부 이벤트 범위)

| 표시 이름 | 이벤트 매개변수 |
|---|---|
| 랜딩 변이 | `landing_variant` |
| 카탈로그 카테고리 | `catalog_category` |
| 브리프 스텝 | `brief_step` |
| 브리프 스텝 이름 | `brief_step_label` |
| 장바구니 크기 | `cart_size` |

### 기존 재사용 (08-06 등록분)

`is_test` · `cta_id` · `form_id` · `last_field` · `percent_scrolled` · `product_id` · `expected_volume` · `lead_type`

`bin/ga4_setup.py --apply`로 등록한다(위키에 기록된 기존 도구). 콘솔 수기 입력 불필요.

**등록 전 표준 속성의 이벤트 범위 맞춤 측정기준 한도 잔여분을 확인한다.** 기존 12개 + 신규 5개다.

### 핵심 이벤트

`generate_lead` 하나로 통일한다. 기존 `conversion_event_submit_lead_form`·`request_sample`은 다른 경로(대시보드 브리프·샘플 요청)라 그대로 둔다.

**`is_test` 표시가 실제로 찍히는 것을 확인한 뒤 핵심 이벤트를 등록한다.** 순서가 바뀌면 테스트 데이터가 전환으로 집계되고 구글 광고가 그 가짜 전환을 학습한다.

## §5 Firestore 조인 — 리드 품질

GA4는 유입 경로만 본다. 리드는 `landingRequests`에 있다. 08-25 회의에서 확인된 진짜 문제는 "제출이 적다"가 아니라 **"제출자 중 절반만 실질 거래 대화로 진행된다"**였다. 제출 수만 비교하면 저품질 제출을 많이 만드는 랜딩이 이긴다.

### `funnelSummary` 추가

`landingRequests` 제출 payload에 행동 요약을 붙인다. 개인정보가 아니다.

```ts
interface LandingFunnelSummary {
  categoriesViewed: string[];   // catalog: 실제로 연 카테고리
  productsViewed: string[];     // catalog: 상세를 연 product_id
  cartSize: number;             // catalog: 제출 시점 담긴 개수
  maxBriefStep: number;         // dashboard: 도달한 최대 스텝
  msToForm: number;             // 페이지 진입 → form_view 까지 경과 ms
}
```

`landingRequests`엔 이미 `gaClientId`·`utm*`·`landingVariant`·`isTest`가 저장된다. `funnelSummary`가 붙으면 어드민에서 GA4를 열지 않고도 "이 리드가 어떤 경로로 왔고 얼마나 성실했나"를 읽을 수 있다.

Firestore 규칙에 `funnelSummary` 키와 크기 상한을 추가해야 한다. **스키마·규칙 변경이므로 구현 전 별도 승인 게이트를 거친다** (AGENTS.md).

### 랜딩별 리드 품질 지표

`landingVariant`별로 (제출 수 / 딜 진행 수)를 본다. 딜 진행 판정은 해당 intake가 `deals`로 연결됐는지로 한다. 화면 위치는 구현 계획에서 정한다.

## §6 표본에 대한 경고

**현재 트래픽에서 전환율 A/B의 통계적 유의 판정은 불가능하다.** 컨택트 폼이 조회 70건에 전환 0건 수준이다. 08-25 회의에서 확인된 arm A/B의 "유의미한 차이 없음"도 상당 부분 표본 크기 탓일 수 있다 — 차이가 없다는 증거가 아니라 판정할 힘이 없었다는 뜻이다.

따라서 **이 계측의 1차 목적은 승자 선정이 아니라 이탈 지점 진단이다.**

진단은 작은 표본에서도 방향이 보인다. 20~30명 중 담기까지 간 사람이 `form_view` 이후 전원 이탈했다면 그건 카탈로그 문제가 아니라 폼 문제다. 이런 판정에는 유의성 검정이 필요 없다.

승자 판정은 표본이 쌓인 뒤 별도로 한다. 그 전에 "카탈로그가 이겼다"는 결론을 내지 않는다.

## §7 검증

1. `?qa=1`을 붙여 각 랜딩을 한 번씩 통과 → GA4 DebugView에서 이벤트 순서와 파라미터 확인
2. `is_test: true`가 붙는지, 운영 경로에서는 안 붙는지 확인
3. 이벤트 발화 단위 테스트 추가 (`tests/landing-attribution.test.ts` 옆)
4. 브라우저에서 실제 클릭 경로 확인 — 탭 전환, 상품 담기/빼기, 폼 도달, 폼 이탈, 제출
5. korea 랜딩의 기존 이벤트가 그대로 발화하는지 회귀 확인 (§3-3에서 공용화하므로)
6. `npm test` · `npm run typecheck` · `npm run lint`

## 수용 기준

- catalog 퍼널 6단계, dashboard 퍼널 6단계가 GA4 탐색에서 각각 열린다
- `form_view`가 두 랜딩 모두에서 폼 렌더 시 정확히 1회 발화한다
- `brief_step_open`의 최댓값으로 "몇 번째 스텝까지 갔나" 분포를 읽을 수 있다
- 세션별 `catalog_category_view`에 초기 `serum`이 포함된다
- `form_abandon`에 입력값이 아닌 필드 이름만 실린다
- GA4에 회사명·담당자명·이메일·메시지가 전송되지 않는다
- korea 랜딩의 기존 이벤트 9종 발화가 변하지 않는다
- 맞춤 측정기준 등록이 배포보다 먼저 완료된다
- 커밋·푸시·배포는 사용자가 명시적으로 요청할 때만 한다
