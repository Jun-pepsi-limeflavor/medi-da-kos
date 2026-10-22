# Meta 픽셀

픽셀 ID `1450327583197410`. 환경변수 `NEXT_PUBLIC_META_PIXEL_ID`로 주입한다(Vercel Production).

## 구조

| 파일 | 역할 |
|---|---|
| `src/components/analytics/MetaPixel.tsx` | 기본 코드 로드, 첫 PageView, 클라이언트 이동 PageView |
| `src/lib/meta-pixel.ts` | `trackMetaEvent` — 표준 이벤트 전송 |
| `src/app/layout.tsx` | 전체 페이지에 삽입 (GA와 같은 범위) |

## 테스트 트래픽

운영 도메인(`medidakos.com`, `www.` 포함)이 아니거나 `?qa=1`이 붙으면 픽셀을 **로드하지 않고** 이벤트도 보내지 않는다. 판정은 GA `is_test`와 같은 `isNonProductionEnv()`를 쓴다.
Meta 광고 최적화에는 `is_test` 같은 필터가 없어 테스트 전환이 그대로 학습되기 때문이다. 대신 콘솔에 `[meta] skipped (test env)` 로그가 남는다.

## 이벤트 매핑

| Meta 표준 이벤트 | GA 이벤트 | 발화 위치 | `content_name` |
|---|---|---|---|
| `PageView` | page_view | 모든 페이지 | — |
| `Lead` | `generate_lead` | Contact 폼 / `/landing/korea` / 카탈로그·대시보드 랜딩 상담 폼 | `contact-page` / `landing-korea` / `landing-{variant}` |
| `Contact` | `email_click` | Contact 페이지·푸터 이메일 클릭 | `contact` / `footer` |
| `CompleteRegistration` | `sign_up` | 이메일 가입, 구글 신규 가입 | — |
| `SubmitApplication` | `conversion_event_submit_lead_form` | 대시보드 CM Wizard 브리프 제출 | — |

개인정보(이메일·회사명·메시지)는 파라미터로 보내지 않는다.

## 확인 방법

- 로컬: 이벤트를 발생시키고 콘솔의 `[meta] skipped (test env) <이벤트> {...}` 로그로 연결을 확인한다.
- 운영: Chrome 확장 Meta Pixel Helper 또는 Events Manager → 테스트 이벤트. 운영 확인은 실제 데이터로 집계되므로 PageView 위주로만 본다.

## 알려진 위험

- 쿠키 동의 배너 없이 설치했다(2026-10-22 결정). EU·영국 방문자에 대해서는 동의 전 로드가 규정 위반이 될 수 있다. 동의 배너는 별도 작업.
- Events Manager의 "자동 고급 매칭"을 켜면 폼 입력값(이메일 등)이 해시되어 전송된다. 켤지 여부는 동의 작업과 함께 정한다.
