# 랜딩 GA4 계측 구현 계획 — catalog·dashboard

> **에이전틱 실행자용:** 이 계획을 태스크 단위로 실행할 때는 `superpowers:subagent-driven-development`(권장) 또는 `superpowers:executing-plans`를 사용한다. 체크박스(`- [ ]`)로 진행을 추적한다.

**목표:** `/landing/catalog`·`/landing/dashboard`에 GA4 이벤트 계측을 배선하고, `landing/analytics.ts`를 `src/lib/analytics.ts`로 흡수 통합한다. `funnelSummary`(스키마 변경)는 별도 승인 후 착수하는 후속 페이즈로 분리한다.

**아키텍처:** 기존 korea 랜딩의 계측 패턴(전역 `is_test`/`landing_variant`, 개인정보 필터, `useRef` 기반 상태 없는 추적)을 그대로 재사용한다. 신규 추상화·신규 의존성 없음.

**기술 스택:** Next.js 16 / React 19 / TypeScript strict, `node --test`, gtag.js(GTM 없음).

**스펙:** [docs/plans/2026-08-30-landing-ga4-tracking.md](2026-08-30-landing-ga4-tracking.md) (선행: [2026-08-27-landing-catalog-dashboard-ab-spec.md](2026-08-27-landing-catalog-dashboard-ab-spec.md)의 `## Measurement` 절 대체)

## Global Constraints

- GTM 도입 금지. gtag.js 직접 호출 유지.
- 이벤트 이름은 랜딩 간 공유, 랜딩별 차이는 파라미터로 분해.
- `is_test` 판정은 `isNonProductionEnv()`(`src/lib/env-flags.ts`) 하나만 쓴다. 인라인 재구현 금지.
- GA4로 회사명·담당자명·이메일·메시지·`pageUrl`·`gaClientId`·`userAgent`를 절대 보내지 않는다 (`privateKeys` 필터 유지).
- `brief_step_label`은 `getBriefStepLabel()`(`src/lib/brief-steps.ts`)을 쓴다. 라벨 재정의 금지.
- 새 파일은 꼭 필요할 때만. 새 npm 의존성 금지(ESLint만, Biome/Jest/Vitest 추가 금지).
- 테스트는 Node 내장 `node --test`. 컴포넌트 내부 로직 검증은 이 저장소의 기존 관례대로 소스 텍스트 정규식 검증(`tests/landing-dashboard-header.test.ts` 패턴)을 쓴다 — jsdom/RTL 추가하지 않는다.
- 스키마·Firestore 규칙 변경(§5 `funnelSummary`)은 구현 전 별도 사용자 승인이 필요하다 (AGENTS.md). 이 계획의 Phase 4로 분리했다.
- 커밋·푸시·배포는 사용자가 명시적으로 요청할 때만 한다.

---

## 코드 실사 결과 — 스펙과 다른 점 (구현 전에 읽을 것)

실제 코드를 전수 확인한 결과, 스펙 본문과 3가지가 어긋난다. 아래를 반영해 태스크를 구성했다.

1. **"파일 6개, 신규 파일 0개"는 부정확하다.** `src/components/landing/LandingDashboard.tsx`가 `src/lib/landing/analytics.ts`에서 `trackLandingEvent`를 직접 import해 `consultation_start` 이벤트를 쏘고 있는데(8·14번 줄), 스펙 §3의 6개 파일 목록에 이 파일이 빠져 있다. `landing/analytics.ts`를 지우면 이 import는 무조건 깨지므로 이 파일은 반드시 같이 고쳐야 한다. **실제로는 7개 파일.**
2. **`bin/ga4_setup.py`는 앱 저장소가 아니라 위키 vault에 있다.** 실제 경로는 `/Users/giwook/Documents/한국기술자산/bin/ga4_setup.py`다. 이 저장소에 없는 게 맞고(`bin/` 디렉터리 없음, `.py` 파일 0개), 스펙이 가리킨 건 vault 쪽 도구였다. 따라서 Phase 2는 **vault 파일 수정**이고, AGENTS.md에 따라 **vault 루트에서 별도 세션으로** 수행해야 한다 — 이 저장소 세션에서 고치지 않는다.
3. **`ConsultationForm.tsx`의 param 이름이 스펙과 다르다.** 현재 `catalog_product_view`/`catalog_category_view` 호출은 `product_category`라는 키를 쓰는데, 스펙 §1 표는 `catalog_category`를 요구한다. `src/lib/landing/request.ts:71`에도 `trackLandingEvent`·`env-flags.ts`와 별개인 **세 번째** `isTest` 인라인 재구현이 있다(스펙은 두 곳만 언급). 이건 GA4 이벤트가 아니라 Firestore 문서의 `isTest` 필드값이라 이번 계측 스펙의 직접 대상이 아니므로 이 계획에서는 건드리지 않는다 — 다만 "판정이 갈리면 어느 쪽이 맞는지 알 수 없다"는 스펙의 우려가 여기도 적용된다는 점을 별도 이슈로 남긴다.

추가로 코드에서 발견했지만 스펙 범위 밖이라 **이 계획에서 손대지 않는** 것: `src/lib/dashboard-brief-context.tsx:21-25`의 `notifyBriefStepChange`는 `mode`와 무관하게 모든 `persistBrief` 호출에서 `brief_step_changed`(GA4)와 `syncBriefStepToChannelTalk`를 이미 쏘고 있다. 즉 랜딩 대시보드(consultation 모드)에서도 스텝을 넘길 때마다 이 기존 이벤트가 새 `brief_step_open`/`brief_step_complete`와 나란히 발화한다. 스펙이 이 파일을 언급하지 않으므로 그대로 두되, GA4 판독 시 `brief_step_changed`와 새 이벤트가 같은 전환에서 중복 발화한다는 걸 알고 있어야 한다.

---

## Phase 1 — 이벤트 배선 (승인 게이트 없음, 바로 구현)

스키마·권한 변경이 없으므로 AGENTS.md의 계획 승인 게이트 대상이 아니다. 7개 파일 + 신규 테스트 파일 1개.

### Task 1.1: `src/lib/analytics.ts`에 `trackLandingEvent` 흡수 + `landing/analytics.ts` 삭제

**Files:**
- Modify: `src/lib/analytics.ts`
- Delete: `src/lib/landing/analytics.ts`
- Modify (import 경로만, 동작 변경 없음): `src/components/landing/CatalogLanding.tsx:11`, `src/components/landing/ConsultationForm.tsx:6`, `src/components/dashboard/CMWizard.tsx:43`, `src/components/landing/LandingDashboard.tsx:8`
- Modify: `tests/landing-request.test.ts` (import 경로 + window stub)

**Interfaces:**
- Produces: `trackLandingEvent(name: string, variant: LandingVariant, params?: Record<string, unknown>): void` — `src/lib/analytics.ts`에서 export. 시그니처는 기존 `landing/analytics.ts`와 동일하므로 호출부 코드는 바뀌지 않는다.

- [ ] **Step 1: `src/lib/analytics.ts`에 병합 구현 작성**

```ts
import { isNonProductionEnv } from "./env-flags";
import type { LandingVariant } from "./landing/types";

// ... 기존 trackConversionEvent, trackBriefStep은 그대로 ...

/**
 * 개인정보가 절대 GA4로 나가지 않게 거르는 신뢰 경계.
 * landing/analytics.ts에서 그대로 옮겼다 — 간소화 대상이 아니다.
 */
const privateKeys = new Set([
  "companyName",
  "contactName",
  "email",
  "message",
  "pageUrl",
  "gaClientId",
  "userAgent",
]);

/** 모든 랜딩 이벤트의 단일 진입점. is_test·landing_variant를 전역으로 붙인다. */
export function trackLandingEvent(
  name: string,
  variant: LandingVariant,
  params: Record<string, unknown> = {},
) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  const safe = Object.fromEntries(
    Object.entries(params).filter(([key]) => !privateKeys.has(key)),
  );
  window.gtag("event", name, {
    ...safe,
    landing_variant: variant,
    is_test: isNonProductionEnv(),
  });
}
```

- [ ] **Step 2: `src/lib/landing/analytics.ts` 삭제**

```bash
rm src/lib/landing/analytics.ts
```

- [ ] **Step 3: import 경로 4곳 수정**

각 파일에서:
```diff
-import { trackLandingEvent } from "@/lib/landing/analytics";
+import { trackLandingEvent } from "@/lib/analytics";
```
대상: `src/components/landing/CatalogLanding.tsx`, `src/components/landing/ConsultationForm.tsx`, `src/components/dashboard/CMWizard.tsx`, `src/components/landing/LandingDashboard.tsx`.

- [ ] **Step 4: `tests/landing-request.test.ts` 수정 — import 경로 + window stub**

기존 "analytics wrapper strips personal data before forwarding" 테스트는 `window.location`이 없는 stub을 써서 `is_test`가 아예 안 붙는 경로를 검증했다. 병합된 구현은 `isNonProductionEnv()`를 무조건 호출하므로 `window.location`이 없으면 `TypeError`가 난다. stub에 `location`을 추가하고, `is_test`가 항상 포함되도록 기대값을 바꾼다.

```diff
-import { trackLandingEvent } from "../src/lib/landing/analytics.ts";
+import { trackLandingEvent } from "../src/lib/analytics.ts";
```

```diff
   globalScope.window = {
     gtag: (name: string, event: string, params: Record<string, unknown>) => {
       calls.push([event, params]);
       assert.equal(name, "event");
     },
+    location: { hostname: "qa.example.com", search: "" },
   };
```

```diff
   assert.equal(calls.length, 1);
   assert.deepEqual(calls[0][1], {
     product_id: catalogItem.id,
     landing_variant: "catalog",
+    is_test: true,
   });
```

`qa.example.com`은 `SITE_URL`(`https://www.medidakos.com`)과 호스트가 다르므로 `isNonProductionEnv()`가 결정적으로 `true`를 반환한다.

- [ ] **Step 5: 검증**

```bash
npm run typecheck
node --test tests/landing-request.test.ts
```
기대: 타입 에러 없음, 전체 통과.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/analytics.ts src/lib/landing/analytics.ts \
  src/components/landing/CatalogLanding.tsx src/components/landing/ConsultationForm.tsx \
  src/components/dashboard/CMWizard.tsx src/components/landing/LandingDashboard.tsx \
  tests/landing-request.test.ts
git commit -m "refactor: merge landing analytics into src/lib/analytics.ts"
```

---

### Task 1.2: `KoreaPageSignals` → `LandingSignals` 일반화 + 이동

**판단 근거 (사용자 확인 필요 — 아래 "판단이 필요한 지점 1"):** 파일명은 유지하지 않고 `src/app/landing/korea/KoreaPageSignals.tsx` → `src/components/landing/LandingSignals.tsx`로 옮긴다. catalog·dashboard 컴포넌트가 `app/landing/korea/` 아래에서 컴포넌트를 import하는 모양은 인수자 입장에서 방향이 뒤집혀 보인다 — `korea/` 안의 파일이 다른 랜딩의 의존성이 되는 구조를 예상하지 못한다. git은 이를 rename으로 추적하므로 "신규 파일 0개" 원칙은 net-new 파일 기준으로는 유지된다.

**Files:**
- Create (rename from `src/app/landing/korea/KoreaPageSignals.tsx`): `src/components/landing/LandingSignals.tsx`
- Delete: `src/app/landing/korea/KoreaPageSignals.tsx`
- Modify: `src/app/landing/korea/page.tsx` (import 경로 + 새 props)
- Modify: `src/app/landing/korea/analytics.ts` (`track` export)

**Interfaces:**
- Produces: `LandingSignals({ variant, arm?, emit?, sectionSelector?, ctaSelector? })` — scroll_depth(25/50/75/100)·section_view(`data-section`)·cta_view(`data-cta`, 3초)·engaged_15s(15초, 탭 숨김 미포함)를 관찰해 `emit(event, params)`으로 내보낸다. `emit` 기본값은 `(event, params) => trackLandingEvent(event, variant, params)`.
- Consumes: `trackLandingEvent`(Task 1.1), `setKoreaArm`·`track`(korea/analytics.ts, 이번 태스크에서 `track` export 추가).

korea의 발화 동작이 바뀌면 안 된다는 제약을 지키는 방법: 관찰 로직(무엇을 언제 잡는지)만 공용화하고, **무엇을 호출할지는 `emit` prop으로 주입**한다. korea는 `emit={track}`을 넘겨 기존처럼 모든 이벤트에 `positioning_arm`이 붙는다. catalog·dashboard는 `emit`을 생략해 기본값(`trackLandingEvent`, `positioning_arm` 없음)을 쓴다.

- [ ] **Step 1: `src/components/landing/LandingSignals.tsx` 작성** (기존 `KoreaPageSignals.tsx` 175줄을 베이스로 아래만 변경)

```diff
-import { useEffect } from "react";
-import {
-  setKoreaArm,
-  trackCtaView,
-  trackEngaged15s,
-  trackScrollDepth,
-  trackSectionView,
-  type KoreaCtaId,
-  type KoreaSectionId,
-} from "./analytics";
+import { useEffect } from "react";
+import { trackLandingEvent } from "@/lib/analytics";
+import { setKoreaArm } from "@/app/landing/korea/analytics";
+import type { LandingVariant } from "@/lib/landing/types";

 const DEPTHS = [25, 50, 75, 100] as const;
 const CTA_DWELL_MS = 3000;
 const ENGAGED_MS = 15000;

-export function KoreaPageSignals({ arm }: { arm: string }) {
-  useEffect(() => {
-    setKoreaArm(arm);
-  }, [arm]);
+interface LandingSignalsProps {
+  variant: LandingVariant;
+  /** korea 전용. 넘기면 setKoreaArm(arm)을 호출해 emit={track} 쪽 positioning_arm을 채운다. */
+  arm?: string;
+  /** 기본값은 trackLandingEvent(event, variant, params). korea는 emit={track}으로 positioning_arm을 보존한다. */
+  emit?: (event: string, params: Record<string, unknown>) => void;
+  sectionSelector?: string;
+  ctaSelector?: string;
+}
+
+export function LandingSignals({
+  variant,
+  arm,
+  emit = (event, params) => trackLandingEvent(event, variant, params),
+  sectionSelector = "[data-section]",
+  ctaSelector = "[data-cta]",
+}: LandingSignalsProps) {
+  useEffect(() => {
+    if (arm !== undefined) setKoreaArm(arm);
+  }, [arm]);
```

나머지 4개 `useEffect` 블록은 그대로 두되, 내부 호출만 바꾼다:

```diff
-          trackScrollDepth(depth);
+          emit("scroll_depth", { percent_scrolled: depth });
```
```diff
-      const targets = document.querySelectorAll<HTMLElement>("[data-section]");
+      const targets = document.querySelectorAll<HTMLElement>(sectionSelector);
   ...
-          trackSectionView(id as KoreaSectionId);
+          emit("section_view", { section_id: id });
```
```diff
-      const targets = document.querySelectorAll<HTMLElement>("[data-cta]");
+      const targets = document.querySelectorAll<HTMLElement>(ctaSelector);
   ...
-              trackCtaView(id as KoreaCtaId);
+              emit("cta_view", { cta_id: id });
```
```diff
-      trackEngaged15s();
+      emit("engaged_15s", {});
```

`useEffect` deps 배열들(`[]`, `[]`, `[]`)은 그대로 둔다 — `emit`이 렌더마다 새 함수가 될 수 있어 엄밀히는 deps에 넣어야 하지만, 기존 파일도 이미 안정적이지 않은 클로저를 `[]` deps로 캡처하는 패턴이라(예: `changeCategory` 참조 등) 동일 관례를 따른다. `emit`은 마운트 시점 값을 캡처해 컴포넌트 생애 동안 고정된 `variant`/`arm`을 가리키므로 실질적으로 문제없다.

- [ ] **Step 2: 원본 삭제**

```bash
git rm src/app/landing/korea/KoreaPageSignals.tsx
```

- [ ] **Step 3: `src/app/landing/korea/analytics.ts`에서 `track` export**

```diff
-function track(event: string, params: Record<string, unknown>) {
+export function track(event: string, params: Record<string, unknown>) {
   trackConversionEvent(event, { ...params, positioning_arm: armForSession });
 }
```

- [ ] **Step 4: `src/app/landing/korea/page.tsx` 수정**

```diff
-import { KoreaPageSignals } from "./KoreaPageSignals";
+import { LandingSignals } from "@/components/landing/LandingSignals";
+import { track } from "./analytics";
```
```diff
-      <KoreaPageSignals arm={arm} />
+      <LandingSignals variant="korea" arm={arm} emit={track} />
```

- [ ] **Step 5: 검증**

```bash
npm run typecheck
```
브라우저 회귀 확인은 §7 최종 검증(Task 1.7 이후)에서 korea·catalog·dashboard를 한 번에 돈다.

- [ ] **Step 6: 커밋**

```bash
git add src/components/landing/LandingSignals.tsx src/app/landing/korea/KoreaPageSignals.tsx \
  src/app/landing/korea/page.tsx src/app/landing/korea/analytics.ts
git commit -m "refactor: generalize KoreaPageSignals into shared LandingSignals"
```

---

### Task 1.3: `CatalogLanding.tsx` 이벤트 배선

**Files:**
- Modify: `src/components/landing/CatalogLanding.tsx`

**Interfaces:**
- Consumes: `trackLandingEvent`(Task 1.1), `LandingSignals`(Task 1.2).

- [ ] **Step 1: import 추가, `hasStartedConsultation` 제거**

```diff
+import { LandingSignals } from "./LandingSignals";
```
```diff
-  const [hasStartedConsultation, setHasStartedConsultation] = useState(false);
```

- [ ] **Step 2: 마운트 시 초기 카테고리 노출 발화**

기존 인트로 gsap effect(45번 줄 부근) 근처에 추가:
```tsx
useEffect(() => {
  trackLandingEvent("catalog_category_view", "catalog", { catalog_category: category });
}, []);
```
(mount 시점 값만 필요하므로 `[]` deps — `category`의 초기값 `"serum"`을 하드코딩하지 않기 위해 state를 그대로 읽는다.)

- [ ] **Step 3: `selectProduct`에서 `consultation_start` 제거, param명 교정, `cart_size` 추가**

```diff
   const selectProduct = (product: CatalogProduct): LandingCatalogItem[] | null => {
     if (selected.some((item) => item.id === product.id)) return selected;
     if (selected.length >= 5) {
       setNotice("You can add up to 5 products to one consultation.");
       return null;
     }
     const next = [...selected, { id: product.id, name: product.name, category: product.category }];
     setSelected(next);
     setNotice("");
-    if (!hasStartedConsultation) {
-      setHasStartedConsultation(true);
-      trackLandingEvent("consultation_start", "catalog");
-    }
     trackLandingEvent("catalog_product_select", "catalog", {
       product_id: product.id,
-      product_category: product.category,
+      catalog_category: product.category,
+      cart_size: next.length,
     });
     return next;
   };
```

참고: `changeCategory`의 탭 전환 발화(129번 줄)는 이미 `catalog_category: nextCategory`로 올바른 키를 쓰고 있다 — 손댈 필요 없다. param명 교정이 실제로 필요한 곳은 `catalog_product_select`(Step 3에서 처리)와 아래 `catalog_product_view` 두 곳뿐이다, 둘 다 `product_category`라는 잘못된 키를 쓰고 있었다.

- [ ] **Step 4: 상품 상세 열기 이벤트 param명 교정**

```diff
-<button type="button" onClick={() => { setDetail(product); trackLandingEvent("catalog_product_view", "catalog", { product_id: product.id, product_category: product.category }); }} ...>
+<button type="button" onClick={() => { setDetail(product); trackLandingEvent("catalog_product_view", "catalog", { product_id: product.id, catalog_category: product.category }); }} ...>
```

- [ ] **Step 5: `Request a consultation` CTA에 `cta_click` + `data-cta` 추가**

```diff
           <SpecularButton
             data-catalog-consultation-cta
+            data-cta="request_consultation"
             disabled={selected.length === 0}
-            onClick={() => { setFormItems(selected); setForm(true); }}
+            onClick={() => {
+              trackLandingEvent("cta_click", "catalog", { cta_id: "request_consultation" });
+              setFormItems(selected);
+              setForm(true);
+            }}
```

- [ ] **Step 6: 트레이 제거 버튼에 `catalog_product_remove` 추가 (현재 이벤트 없음)**

```diff
-<button type="button" onClick={() => setSelected((items) => items.filter((selectedItem) => selectedItem.id !== item.id))} key={item.id} ...>{item.name} ×</button>
+<button
+  type="button"
+  onClick={() => setSelected((items) => {
+    const next = items.filter((selectedItem) => selectedItem.id !== item.id);
+    trackLandingEvent("catalog_product_remove", "catalog", { product_id: item.id, cart_size: next.length });
+    return next;
+  })}
+  key={item.id}
+  ...
+>{item.name} ×</button>
```

- [ ] **Step 7: 공용 신호 컴포넌트 마운트**

`return (<section ref={landingRef}>` 바로 아래에 추가:
```diff
   return (
     <section ref={landingRef}>
+      <LandingSignals variant="catalog" />
       <div className="max-w-3xl" data-catalog-intro>
```

- [ ] **Step 8: 검증**

```bash
npm run typecheck
```

- [ ] **Step 9: 커밋**

```bash
git add src/components/landing/CatalogLanding.tsx
git commit -m "feat: wire GA4 events into CatalogLanding"
```

---

### Task 1.4: `ConsultationForm.tsx` 이벤트 배선 (catalog·dashboard 공유)

두 랜딩이 이 폼을 공유하므로 여기 한 곳만 고치면 양쪽이 동시에 해결된다. korea의 `KoreaLeadForm.tsx`가 이미 증명한 패턴(`startedRef`/`lastFieldRef`/`submittedRef` + `pagehide` beacon)을 그대로 재사용한다 — 새 메커니즘을 만들지 않는다.

**Files:**
- Modify: `src/components/landing/ConsultationForm.tsx`

**Interfaces:**
- Consumes: `trackLandingEvent`(Task 1.1).

- [ ] **Step 1: refs 추가**

```diff
   const [failure, setFailure] = useState(""); const [sending, setSending] = useState(false); const [complete, setComplete] = useState(false);
+  const startedRef = useRef(false);
+  const lastFieldRef = useRef("");
+  const submittedRef = useRef(false);
```

- [ ] **Step 2: `form_view` 마운트 이펙트**

```tsx
useEffect(() => {
  trackLandingEvent("form_view", variant, { form_id: "landing-consultation" });
}, [variant]);
```

- [ ] **Step 3: `form_abandon` — pagehide + beacon**

```tsx
// 쓰다 말고 떠난 경우. pagehide는 뒤로가기·탭 닫기·모바일 백그라운드 전환을 모두 덮는다.
// KoreaLeadForm.tsx와 동일 패턴.
useEffect(() => {
  const onLeave = () => {
    if (!startedRef.current || submittedRef.current) return;
    startedRef.current = false;
    trackLandingEvent("form_abandon", variant, {
      form_id: "landing-consultation",
      last_field: lastFieldRef.current || "(unknown)",
      transport_type: "beacon",
    });
  };
  window.addEventListener("pagehide", onLeave);
  return () => window.removeEventListener("pagehide", onLeave);
}, [variant]);
```

- [ ] **Step 4: `submit()`에서 `consultation_submit` → `generate_lead`**

```diff
       await submitLandingRequest(input, attribution);
-      trackLandingEvent("consultation_submit", variant, {
+      trackLandingEvent("generate_lead", variant, {
+        lead_type: "consultation",
         expected_volume: fields.expectedVolume,
         utm_source: attribution.utmSource,
         utm_medium: attribution.utmMedium,
         utm_campaign: attribution.utmCampaign,
         utm_content: attribution.utmContent,
       });
+      submittedRef.current = true;
       setComplete(true);
```

- [ ] **Step 5: `form_start` + 필드 식별을 위한 `name` 속성**

`<form>` 태그:
```diff
-<form noValidate onSubmit={submit} className="space-y-5">
+<form
+  noValidate
+  onSubmit={submit}
+  onFocusCapture={(e) => {
+    const field = (e.target as HTMLElement).getAttribute("name");
+    if (field) lastFieldRef.current = field;
+    if (startedRef.current) return;
+    startedRef.current = true;
+    trackLandingEvent("form_start", variant, { form_id: "landing-consultation" });
+  }}
+  className="space-y-5"
+>
```

각 입력 요소에 `name={key}` 추가 (labels.map 안 textarea·input 둘 다):
```diff
-<textarea value={fields[key]} onChange={(e) => change(key, e.target.value)} ... />
+<textarea name={key} value={fields[key]} onChange={(e) => change(key, e.target.value)} ... />
```
```diff
-<input type={key === "email" ? "email" : "text"} value={fields[key]} onChange={(e) => change(key, e.target.value)} ... />
+<input name={key} type={key === "email" ? "email" : "text"} value={fields[key]} onChange={(e) => change(key, e.target.value)} ... />
```

- [ ] **Step 6: 검증**

```bash
npm run typecheck
```

- [ ] **Step 7: 커밋**

```bash
git add src/components/landing/ConsultationForm.tsx
git commit -m "feat: wire form_view/form_start/form_abandon/generate_lead into ConsultationForm"
```

---

### Task 1.5: `LandingDashboard.tsx` — `consultation_start` 제거

Task 1.1이 import 경로만 옮겼으니, 이번 태스크는 그 호출 자체를 지운다. 대체 이벤트는 없다 — 스펙의 `consultation_start` → `catalog_product_select` 대응은 catalog 전용이고(스펙 표의 "지금 이 이벤트는 첫 상품 담기에서 발화한다"는 CatalogLanding의 호출부를 가리킨다), dashboard 쪽은 바로 다음에 뜨는 `ConsultationForm`의 `form_view`가 "폼까지 감"을 이미 커버한다.

**Files:**
- Modify: `src/components/landing/LandingDashboard.tsx`

- [ ] **Step 1: 호출과 미사용 import 제거**

```diff
 import { CMWizard } from "@/components/dashboard/CMWizard";
 import { DashboardStepProvider } from "@/lib/dashboard-step-context";
 import { LandingDashboardBriefProvider } from "@/lib/dashboard-brief-context";
 import type { CMBrief } from "@/lib/types";
-import { trackLandingEvent } from "@/lib/analytics";
 import { ConsultationForm } from "./ConsultationForm";

 function DashboardContent() {
   const [ready, setReady] = useState<CMBrief | null>(null);
   if (ready) return <ConsultationForm variant="dashboard" dashboardBrief={ready} onBack={() => setReady(null)} />;
-  return <CMWizard mode="consultation" onConsultationReady={(brief) => { trackLandingEvent("consultation_start", "dashboard"); setReady(brief); }} />;
+  return <CMWizard mode="consultation" onConsultationReady={(brief) => setReady(brief)} />;
 }
```

- [ ] **Step 2: 검증**

```bash
npm run typecheck
npm run lint
```

- [ ] **Step 3: 커밋**

```bash
git add src/components/landing/LandingDashboard.tsx
git commit -m "fix: remove deprecated consultation_start call from LandingDashboard"
```

---

### Task 1.6: `CMWizard.tsx` + `LandingDashboardHeader.tsx` 이벤트 배선

**판단 근거 (사용자 확인 필요 — 아래 "판단이 필요한 지점 2"):** `brief_step_open`은 `persist()`가 아니라 스텝이 화면에 나타나는 순간을 잡는 별도 `useEffect`에서 쏜다. 기존 gsap 인트로 이펙트(95-106번 줄)와 같은 위치·같은 deps 패턴을 쓰되 `activeStarted`를 deps에 추가한다 — `activeStarted`가 `false→true`로 바뀌는 순간(= "Start Your Product Brief" 클릭으로 스텝 콘텐츠가 처음 DOM에 마운트되는 순간)에도 effect가 재실행되게 하기 위해서다. 이렇게 하면 1단계를 "열었지만 아직 저장 전"인 상태도 잡힌다 — `persist()`에서만 쏘던 기존 `dashboard_step_view`가 구조적으로 놓치던 지점이다.

**Files:**
- Modify: `src/components/dashboard/CMWizard.tsx`
- Modify: `src/components/landing/LandingDashboardHeader.tsx`

**Interfaces:**
- Consumes: `trackLandingEvent`(Task 1.1), `getBriefStepLabel`(`src/lib/brief-steps.ts`, 기존), `LandingSignals`(Task 1.2).

- [ ] **Step 1: `CMWizard.tsx` — import 추가**

Task 1.1 Step 3을 거치면 이 파일엔 이미 `@/lib/analytics`에서 오는 import가 두 줄(`trackConversionEvent`, `trackLandingEvent`)로 나뉘어 있다. 하나로 합치고 나머지 두 개를 추가한다:

```diff
-import { trackConversionEvent } from "@/lib/analytics";
-import { trackLandingEvent } from "@/lib/analytics";
+import { trackConversionEvent, trackLandingEvent } from "@/lib/analytics";
+import { getBriefStepLabel } from "@/lib/brief-steps";
+import { LandingSignals } from "@/components/landing/LandingSignals";
```

- [ ] **Step 2: `brief_step_open` 이펙트 추가**

기존 gsap 인트로 이펙트(95-106번 줄) 바로 다음에 추가:
```tsx
useEffect(() => {
  if (mode !== "consultation" || !currentStep || !activeStarted) return;
  trackLandingEvent("brief_step_open", "dashboard", {
    brief_step: currentStep,
    brief_step_label: getBriefStepLabel(currentStep),
  });
}, [currentStep, mode, activeStarted]);
```

- [ ] **Step 3: `persist()` — `dashboard_step_view` 제거, `brief_step_complete` 추가**

```diff
   async function persist(next: CMBrief, advance = false) {
     setSaving(true);
+    const completingStep = next.currentStep;
     const updated = await persistBrief(next, advance);
-    if (mode === "consultation") {
-      trackLandingEvent("dashboard_step_view", "dashboard", { dashboard_step: updated.currentStep });
-    }
+    if (mode === "consultation" && advance) {
+      trackLandingEvent("brief_step_complete", "dashboard", {
+        brief_step: completingStep,
+        brief_step_label: getBriefStepLabel(completingStep),
+      });
+    }
     setSaving(false);
```

`completingStep`은 `persistBrief` 호출 **전** `next.currentStep`이다 — `src/lib/dashboard-brief-context.tsx:137`에서 `persistBrief`가 `advance`일 때 `Math.min(6, next.currentStep + 1)`로 증가시키므로, `next.currentStep`이 "방금 완료한" 스텝이고 `updated.currentStep`은 "다음에 열릴" 스텝이다. `brief_step_complete`는 전자를 써야 "그 스텝을 막 끝냈다"는 뜻이 맞는다. `advance` 조건을 추가한 이유: "Back" 버튼도 `persist(..., false)`를 호출하는데 뒤로 가는 건 "완료"가 아니다.

- [ ] **Step 4: 공용 신호 컴포넌트 마운트**

```diff
       {mode === "consultation" ? (
-        <LandingDashboardHeader
-          currentStep={step}
-          message={message}
-          isStarted={activeStarted}
-          onStart={handleStartBrief}
-        />
+        <>
+          <LandingSignals variant="dashboard" />
+          <LandingDashboardHeader
+            currentStep={step}
+            message={message}
+            isStarted={activeStarted}
+            onStart={handleStartBrief}
+          />
+        </>
       ) : (
```

- [ ] **Step 5: `LandingDashboardHeader.tsx` — import 추가**

```diff
+import { trackLandingEvent } from "@/lib/analytics";
```

- [ ] **Step 6: "Start Your Product Brief" 버튼에 `cta_click` + `data-cta`**

```diff
                   <SpecularButton
-                    onClick={onStart}
+                    onClick={() => {
+                      trackLandingEvent("cta_click", "dashboard", { cta_id: "start_brief" });
+                      onStart();
+                    }}
+                    data-cta="start_brief"
                     data-testid="start-brief-btn"
```

- [ ] **Step 7: "Scroll to form ↓" 버튼에 `cta_click` + `data-cta`**

```diff
               <button
                 type="button"
-                onClick={onStart}
+                data-cta="scroll_to_form"
+                onClick={() => {
+                  trackLandingEvent("cta_click", "dashboard", { cta_id: "scroll_to_form" });
+                  onStart();
+                }}
                 className="font-medium text-sky-600 hover:text-sky-700 hover:underline cursor-pointer"
               >
                 Scroll to form ↓
```

- [ ] **Step 8: 검증**

```bash
npm run typecheck
node --test tests/landing-dashboard-header.test.ts
```
`landing-dashboard-header.test.ts`는 소스 텍스트 정규식 검증이라 위 diff의 정확한 표현(`onStart={handleStartBrief}` 패턴 등)이 깨지지 않았는지 함께 확인된다.

- [ ] **Step 9: 커밋**

```bash
git add src/components/dashboard/CMWizard.tsx src/components/landing/LandingDashboardHeader.tsx
git commit -m "feat: replace dashboard_step_view with brief_step_open/complete, wire cta_click"
```

---

### Task 1.7: 이벤트 발화 회귀 테스트 신설

스펙 §7-3 "이벤트 발화 단위 테스트 추가 (`tests/landing-attribution.test.ts` 옆)"에 대응한다. 이 저장소에는 jsdom/RTL이 없으므로 `tests/landing-dashboard-header.test.ts`가 이미 쓰는 방식 — 소스 파일을 텍스트로 읽어 정규식으로 검증 — 을 그대로 따른다. 새 파일 1개.

**Files:**
- Create: `tests/landing-events.test.ts`

- [ ] **Step 1: 테스트 작성**

```ts
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const source = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("CatalogLanding fires catalog-scoped events with catalog_category param naming", async () => {
  const content = await source("../src/components/landing/CatalogLanding.tsx");

  assert.match(content, /trackLandingEvent\("catalog_category_view", "catalog", \{ catalog_category: category \}\)/);
  assert.match(content, /catalog_category: nextCategory/);
  assert.match(content, /catalog_category: product\.category/);
  assert.match(content, /"catalog_product_select"[\s\S]{0,120}cart_size: next\.length/);
  assert.match(content, /"catalog_product_remove"/);
  assert.match(content, /cta_id: "request_consultation"/);
  assert.match(content, /<LandingSignals variant="catalog" \/>/);

  // 폐기된 이벤트가 되살아나지 않는지 회귀 확인
  assert.doesNotMatch(content, /consultation_start/);
  assert.doesNotMatch(content, /product_category:/);
});

test("ConsultationForm fires form_view/form_start/form_abandon/generate_lead", async () => {
  const content = await source("../src/components/landing/ConsultationForm.tsx");

  assert.match(content, /"form_view", variant, \{ form_id: "landing-consultation" \}/);
  assert.match(content, /"form_start", variant/);
  assert.match(content, /"form_abandon", variant[\s\S]{0,200}transport_type: "beacon"/);
  assert.match(content, /"generate_lead", variant[\s\S]{0,80}lead_type: "consultation"/);
  assert.match(content, /addEventListener\("pagehide", onLeave\)/);

  assert.doesNotMatch(content, /"consultation_submit"/);
});

test("CMWizard replaces dashboard_step_view with brief_step_open/complete", async () => {
  const content = await source("../src/components/dashboard/CMWizard.tsx");

  assert.match(content, /"brief_step_open", "dashboard"/);
  assert.match(content, /"brief_step_complete", "dashboard"/);
  assert.match(content, /getBriefStepLabel\(currentStep\)/);
  assert.match(content, /getBriefStepLabel\(completingStep\)/);
  assert.match(content, /<LandingSignals variant="dashboard" \/>/);

  assert.doesNotMatch(content, /dashboard_step_view/);
});

test("LandingDashboardHeader fires cta_click for start_brief and scroll_to_form", async () => {
  const content = await source("../src/components/landing/LandingDashboardHeader.tsx");

  assert.match(content, /cta_id: "start_brief"/);
  assert.match(content, /cta_id: "scroll_to_form"/);
  assert.match(content, /data-cta="start_brief"/);
  assert.match(content, /data-cta="scroll_to_form"/);
});

test("LandingDashboard no longer fires the deprecated consultation_start event", async () => {
  const content = await source("../src/components/landing/LandingDashboard.tsx");

  assert.doesNotMatch(content, /consultation_start/);
  assert.doesNotMatch(content, /lib\/landing\/analytics/);
});

test("korea's own event surface is unchanged by the LandingSignals generalization", async () => {
  const analytics = await source("../src/app/landing/korea/analytics.ts");
  const page = await source("../src/app/landing/korea/page.tsx");

  for (const name of ["section_view", "faq_open", "positioning_arm", "scroll_depth", "cta_view", "engaged_15s", "form_start", "form_abandon"]) {
    assert.ok(analytics.includes(name), `korea/analytics.ts should still reference ${name}`);
  }
  assert.match(page, /<LandingSignals variant="korea" arm=\{arm\} emit=\{track\} \/>/);
});
```

- [ ] **Step 2: 실행해 통과 확인**

```bash
node --test tests/landing-events.test.ts
```
기대: 전체 통과. 실패하면 diff와 실제 소스 표현이 어긋난 것이니 정규식이 아니라 소스를 기준으로 정규식을 고친다.

- [ ] **Step 3: 커밋**

```bash
git add tests/landing-events.test.ts
git commit -m "test: add source-assertion regression tests for landing GA4 event wiring"
```

---

### Phase 1 최종 검증

- [ ] `npm test` (전체 스위트)
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `?qa=1`을 붙여 catalog·dashboard·korea 3개 랜딩을 브라우저에서 한 번씩 통과 (`preview_start`로 dev 서버 확인). GA4 DebugView 확인은 GA_ID/네트워크 설정이 있어야 하므로 이 세션에서 불가능하면 그 사실을 명시한다.
- [ ] korea 랜딩에서 기존 9개 이벤트(`scroll_depth`·`section_view`·`faq_open`·`cta_click`·`form_start`·`form_abandon`·`cta_view`·`engaged_15s`·`generate_lead`)가 브라우저 콘솔 네트워크 탭에서 그대로 나가는지 확인 — `positioning_arm` 파라미터가 여전히 붙는지 특히 확인 (Task 1.2의 핵심 리스크 지점).

---

## Phase 2 — GA4 콘솔 등록 (배포 전, 코드 아님)

**순서 제약 (스펙 §4, 위반 시 데이터 영구 손실):** 이 단계는 Phase 1의 코드가 프로덕션에 배포되기 **전에** 끝나야 한다. 맞춤 측정기준은 등록 시점부터의 데이터만 채워지고 소급되지 않는다.

**도구:** `/Users/giwook/Documents/한국기술자산/bin/ga4_setup.py` (위키 vault). 속성은 `properties/538293527`. `--apply` 없이 실행하면 무엇을 만들지 보여주기만 하고, 이미 있는 항목은 건너뛰며, 삭제·수정은 하지 않는다 — 재실행이 안전하다.

**vault 파일 수정은 이 저장소 세션에서 하지 않는다.** AGENTS.md: "vault 수정은 vault 루트에서 별도 세션으로 수행한다." 아래 5개 튜플을 그 스크립트의 `DIMENSIONS` 리스트에 추가하는 작업은 vault 세션에서 한다.

```python
("랜딩 변이", "landing_variant", "catalog / dashboard / korea"),
("카탈로그 카테고리", "catalog_category", "serum / toner / cream / mist"),
("브리프 스텝", "brief_step", "1~6"),
("브리프 스텝 이름", "brief_step_label", "Category / Packaging / ..."),
("장바구니 크기", "cart_size", "해당 동작 직후 담긴 개수"),
```

아래는 사용자가 직접 실행할 체크리스트다.

- [ ] 표준 속성의 이벤트 범위 맞춤 측정기준 잔여 한도 확인 (기존 12개 + 신규 5개 = 17개가 한도 안에 들어오는지)
- [ ] vault 세션에서 `DIMENSIONS`에 위 5개 추가 → `python3 bin/ga4_setup.py`로 미리보기 → `--apply`로 등록:

| 표시 이름 | 이벤트 매개변수 |
|---|---|
| 랜딩 변이 | `landing_variant` |
| 카탈로그 카테고리 | `catalog_category` |
| 브리프 스텝 | `brief_step` |
| 브리프 스텝 이름 | `brief_step_label` |
| 장바구니 크기 | `cart_size` |

- [ ] 기존 재사용 확인 (08-06 등록분, 새로 등록할 필요 없음): `is_test`·`cta_id`·`form_id`·`last_field`·`percent_scrolled`·`product_id`·`expected_volume`·`lead_type`
- [ ] Phase 1 코드 배포

---

## Phase 3 — `is_test` 실측 확인 후 핵심 이벤트 등록 (배포 후, 코드 아님)

**순서 제약 (스펙 §4):** `is_test` 표시가 실제로 찍히는 걸 GA4 DebugView에서 확인한 뒤에만 `generate_lead`를 핵심 이벤트로 등록한다. 순서가 바뀌면 테스트 트래픽이 전환으로 집계되고 Google Ads가 가짜 전환을 학습한다.

- [ ] 배포된 프로덕션 URL에서 `?qa=1` 없이 한 번, `?qa=1`을 붙여 한 번 — 각 랜딩에서 최소 하나의 이벤트를 발생시킨다
- [ ] GA4 DebugView에서 `?qa=1` 세션은 `is_test: true`, 일반 세션은 `is_test`가 아예 없거나(맞춤 측정기준 미등록 직후 몇 시간 지연 가능) `false`로 찍히는지 확인
- [ ] `generate_lead`는 **이미 핵심 이벤트로 등록되어 있다** — `ga4_setup.py`의 `KEY_EVENTS = ["generate_lead", "request_sample"]`(08-06 등록분). 추가 등록 작업은 없다.
- [ ] 다만 이번 배포로 **두 랜딩에서 `generate_lead`가 처음 발화하기 시작하므로**, 테스트 트래픽 제외가 이 시점부터 실질적으로 중요해진다. 내부 트래픽 데이터 필터가 「테스트」가 아니라 「사용」 상태인지 확인한다
- [ ] GA4 탐색 → 유입경로 탐색에서 catalog·dashboard 퍼널 각 1장 생성 (스펙 §2 6단계 표 그대로). 단계 조건에 "페이지 경로"가 아니라 `page_location` **포함** `/landing/catalog`(또는 `/landing/dashboard`)로 걸어야 한다 — **정확히 일치**로 걸면 UTM 붙은 유입이 전부 빠진다
- [ ] 분모는 `세션수`, `참여 세션수`가 아니다 — 이유는 스펙 §2 참조
- [ ] 맞춤 측정기준 등록 당일 데이터는 판독하지 않는다. 다음 날 "최근 7일"로 연다

**표본 크기 경고 (스펙 §6, 판독 시 유의):** 현재 트래픽에서 전환율 A/B의 통계적 유의 판정은 불가능하다. 이 계측의 1차 목적은 승자 선정이 아니라 이탈 지점 진단이다. 표본이 쌓이기 전에 "카탈로그가 이겼다" 같은 결론을 내리지 않는다.

---

## Phase 4 — `funnelSummary` + Firestore 규칙 (별도 승인 게이트, 스키마 변경)

**이 페이즈는 구현하지 않는다. 아래는 설계안이며, 사용자가 데이터 모양과 접근 규칙을 승인한 뒤 별도 계획/세션에서 코드화한다 (AGENTS.md: "스키마, 권한 규칙... 바꿀 때는 데이터 모양과 접근 규칙을 먼저 적고 사용자 승인을 받은 뒤 구현한다").**

### 왜 이 페이즈가 분리됐는가

`landingRequests`는 클라이언트가 직접 `create`하는 컬렉션이고(`firestore.rules:130-141`), 규칙이 허용 키 목록(`hasOnly([...])`)을 화이트리스트로 검사한다. `funnelSummary` 필드를 추가하려면 이 화이트리스트와 크기 상한을 규칙에 추가해야 하는데, 이건 코드 스타일 변경이 아니라 "누가 무엇을 쓸 수 있는가"의 변경이다.

### 데이터 모양 (스펙 §5 그대로, 변경 없음)

```ts
interface LandingFunnelSummary {
  categoriesViewed: string[];   // catalog: 실제로 연 카테고리
  productsViewed: string[];     // catalog: 상세를 연 product_id
  cartSize: number;             // catalog: 제출 시점 담긴 개수
  maxBriefStep: number;         // dashboard: 도달한 최대 스텝
  msToForm: number;             // 페이지 진입 → form_view까지 경과 ms
}
```

`src/lib/landing/types.ts`의 `LandingRequestInput`/`LandingRequestSubmission`에 `funnelSummary?: LandingFunnelSummary`를 추가한다 (catalog·dashboard만 해당, korea는 대상 아님 — korea는 이번 계측 스펙 범위 밖이라는 스펙 서문과 일관).

### 판단이 필요한 지점 3 — 상태 없이 어떻게 누적하나

**결정 및 근거 (사용자 확인 필요):** 새 상태관리(리듀서·스토어)를 추가하지 않고, 이미 이 코드베이스가 쓰는 `useRef`(예: `categoryTimeline`, `dialogExitTimeline`)와 동일한 패턴으로 값을 누적한다.

- **`categoriesViewed`/`productsViewed` (catalog):** `CatalogLanding.tsx`에 `viewedCategoriesRef = useRef<Set<string>>(new Set())`, `viewedProductsRef = useRef<Set<string>>(new Set())`를 추가하고, 기존 `catalog_category_view`/`catalog_product_view` 발화 지점(Task 1.3에서 이미 자리를 잡아뒀다)에 `.add(...)` 한 줄씩 얹는다. GA4 이벤트 발화와 별개의 부수효과라 리렌더를 유발하지 않는 `ref`가 정확히 맞는 도구다.
- **`cartSize` (catalog):** 이미 `selected.length`가 있다 — 제출 시점에 그대로 읽는다. 누적 불필요.
- **`maxBriefStep` (dashboard):** `CMWizard.tsx`에 `maxStepRef = useRef(1)`를 추가하고, Task 1.6에서 만든 `brief_step_open` 이펙트 안에서 `maxStepRef.current = Math.max(maxStepRef.current, currentStep)`를 같이 갱신한다. `onConsultationReady`의 시그니처를 `(brief: CMBrief, maxBriefStep: number) => void`로 확장해 `LandingDashboard.tsx`(Task 1.5에서 이미 손댄 파일)로 넘긴다.
- **`msToForm`:** `CatalogLanding.tsx`·`CMWizard.tsx`(또는 그 상위인 `LandingDashboard.tsx`) 각각에 `landingEnteredAtRef = useRef(Date.now())`를 마운트 시점에 고정하고, `ConsultationForm`에 `landingEnteredAt?: number` prop으로 넘긴다. `ConsultationForm`의 `form_view` 이펙트(Task 1.4)에서 `Date.now() - landingEnteredAt`을 계산해 `funnelSummary.msToForm`에 쓴다. prop이 없으면(수동 접근 등 예외 상황) `0`으로 폴백한다.

이 방식은 신규 상태관리 라이브러리·context·store 없이 기존 `useRef` 관례만으로 끝난다. `funnelSummary` 자체는 `submitLandingRequest` 호출 시점에 이 ref들의 스냅샷을 한 번 읽어 `buildLandingRequest`에 새 인자로 넘기는 형태가 될 것이다 (정확한 함수 시그니처는 승인 후 코드화 단계에서 확정).

### 건드릴 파일 (승인 후)

- `src/lib/landing/types.ts` — `LandingFunnelSummary`, `LandingRequestInput`/`Submission` 확장
- `src/lib/landing/request.ts` — `buildLandingRequest`가 `funnelSummary`를 받아 payload에 싣도록
- `src/components/landing/CatalogLanding.tsx` — `viewedCategoriesRef`/`viewedProductsRef`
- `src/components/dashboard/CMWizard.tsx` — `maxStepRef`, `onConsultationReady` 시그니처 확장
- `src/components/landing/LandingDashboard.tsx` — 확장된 `onConsultationReady` 수신
- `src/components/landing/ConsultationForm.tsx` — `landingEnteredAt` prop, 제출 시 `funnelSummary` 조립
- `firestore.rules` — `landingRequests`의 `catalog`/`dashboard` 분기 `hasOnly([...])`에 `funnelSummary` 추가 + 크기·타입 상한 규칙(문자열 배열 길이, 개별 문자열 길이, `cartSize`/`maxBriefStep`/`msToForm`의 숫자 범위)
- `tests/firestore-landing-requests.test.ts` — 에뮬레이터 규칙 테스트에 `funnelSummary` 포함/누락/초과 케이스 추가 (Firestore Emulator + JDK 21+ 필요, AGENTS.md)

### 어드민 UI 위치 제안 (스펙이 "구현 계획에서 정한다"고 위임한 부분)

`src/app/admin/(dash)/intakes/page.tsx`가 이미 `landingRequests` 컬렉션을 읽어 `IntakeRowDetail[]`을 만들고 있다(16번 줄, `db.collection("landingRequests").get()`). 이 파일이 만드는 `IntakeRowDetail`과 그걸 렌더하는 `IntakeDetailModal`이 `funnelSummary`가 자연스럽게 붙을 자리다 — 새 화면을 만들지 않고 기존 인테이크 상세 모달에 "행동 요약" 섹션 하나를 추가하는 것으로 충분해 보인다. `landingVariant`별 (제출 수 / 딜 진행 수) 비율은 `IntakeTableClient`가 이미 랜딩별 필터링을 하고 있다면 그 위에 집계 행 하나를 얹는 정도로 끝날 가능성이 높다 — 다만 이 파일들의 정확한 현재 모양은 이번 조사에서 읽지 않았으므로, 승인 후 코드화 단계에서 다시 확인해야 한다.

### 검증 (승인 후)

- [ ] `tests/firestore-landing-requests.test.ts`에 케이스 추가 후 에뮬레이터로 실행 (`firebase emulators:exec` 또는 기존 스크립트 — 이 저장소의 정확한 실행 커맨드는 그 테스트 파일 상단 또는 `package.json`에서 재확인)
- [ ] `npm test` · `npm run typecheck` · `npm run lint`
- [ ] 브라우저에서 실제 제출 1회 후 Firestore 콘솔(또는 admin 뷰)에서 `funnelSummary` 값이 실제 행동과 일치하는지 확인

---

## 수용 기준 매핑

| 스펙의 수용 기준 | 만족 페이즈 |
|---|---|
| catalog·dashboard 퍼널 6단계가 GA4 탐색에서 열린다 | Phase 3 |
| `form_view`가 두 랜딩 모두 폼 렌더 시 정확히 1회 | Phase 1 (Task 1.4) |
| `brief_step_open` 최댓값으로 도달 스텝 분포를 읽는다 | Phase 1 (Task 1.6) + Phase 3 판독 |
| 세션별 `catalog_category_view`에 초기 `serum` 포함 | Phase 1 (Task 1.3 Step 2) |
| `form_abandon`에 필드 이름만, 입력값 없음 | Phase 1 (Task 1.4 Step 3) |
| 회사명·담당자명·이메일·메시지가 GA4로 안 나간다 | Phase 1 (Task 1.1, `privateKeys` 유지) |
| korea 기존 이벤트 9종 발화 불변 | Phase 1 (Task 1.2, `emit={track}`) |
| 맞춤 측정기준 등록이 배포보다 먼저 | Phase 2 → Phase 1 배포 순서 강제 |
| 커밋·푸시·배포는 사용자 요청 시에만 | 전 페이즈 공통 (Global Constraints) |

---

## 판단이 필요한 지점 — 요약 (사용자 확인 요청)

1. **파일명/위치:** `KoreaPageSignals.tsx`를 `src/components/landing/LandingSignals.tsx`로 이동·개명한다 (Task 1.2). 이유: catalog가 `korea/` 아래 파일을 import하는 모양이 방향이 뒤집혀 보인다. korea의 `section_view`/`faq_open`/`positioning_arm`은 `emit` prop 주입으로 그대로 유지된다.
2. **`brief_step_open` 발화 위치:** `persist()`가 아니라 `[currentStep, mode, activeStarted]`에 걸린 별도 `useEffect`에서 쏜다 (Task 1.6). 이유: `activeStarted`가 deps에 있어야 "Start Your Product Brief" 클릭으로 1단계가 처음 열리는 순간도 잡힌다 — 진행(advance) 때만 쏘면 스펙이 지적한 "1단계 열고 이탈이 구조적으로 0" 문제가 그대로 남는다.
3. **`funnelSummary` 누적 방식 (Phase 4, 설계만):** 신규 상태관리 없이 `useRef` 스냅샷(카테고리/상품은 `Set`, 스텝은 최댓값, 진입시각은 고정 타임스탬프)으로 처리한다. 이유: 이 코드베이스가 이미 여러 곳에서 `useRef`로 렌더 비영향 상태를 다루고 있고(gsap 타임라인 등), 이 패턴이 가장 짧은 diff다.
