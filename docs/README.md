# Medidakos 프로젝트 구조

신규 홈페이지 공동 개발 기준 구조다(2026-11-05 정리, Figma `Website Design — Desktop` 최종 디자인 기준 검토·같은 날 재확인). 새 파일은 아래 위치에 둔다.

## 폴더

```text
public/
  images/{home,about,services,portfolio,categories,common}/   페이지별 이미지 (categories: 제품 카테고리 타일)
  logos/certifications/   인증 마크 (FDA, EU CPNP, ISO 22716, ISO 9001, MFDS, ISO 14001, GMP, GMPC)
  logos/                  Medidakos 로고·심볼 원본(현재 최종 로고는 텍스트 워드마크)
  icons/                  lucide에 없는 아이콘 (예: Google 로그인)
  og/                     OG·Twitter 이미지
  downloads/              다운로드 파일 (Brief template)
src/
  app/
    (marketing)/          공개 페이지: / , /about-us , /contact (공통 레이아웃: layout.tsx)
    login/                로그인·회원가입
    api/channel-talk/     Channel Talk member-hash (서버)
    api/kakaowork/        KakaoWork callback
    layout.tsx            전역 레이아웃·메타데이터, GA4·Meta Pixel·Channel Talk·Auth 연결
    manifest.ts robots.ts sitemap.ts
  components/
    layout/               Header, Footer, MarketingShell
    home/ about/ services/ portfolio/ faq/   페이지 전용 섹션·컴포넌트
    legal/                Privacy Policy·Terms 공통 레이아웃 (목차·본문)
    cookie-consent/       쿠키 배너·쿠키 설정 모달 (전 페이지 공통)
    contact/              ContactForm
    auth/                 LoginForm
    ui/                   2개 이상 페이지에서 쓰는 공통 UI (SocialLinks, SocialIcons, 앞으로 Button·Input 등)
    analytics/            GoogleAnalytics, MetaPixel, TrackedMailLink
    seo/                  OrganizationJsonLd
    channel-talk/         Channel Talk 위젯 boot
  hooks/                  use-utm-params
  lib/
    firebase/             client(웹 SDK), admin(Admin SDK, 서버 전용), firestore-service(회원·Contact 저장), sanitize
    channel-talk/         client(위젯 SDK), intake(제출 문서 식별 필드), member-hash(서버)
    analytics/            events(GA4·Meta 전환 이벤트), meta-pixel, ga-client-id
    auth/                 auth-context(Firebase Auth), mock-auth(로컬 mock 로그인)
    contact/              form-options(Contact 선택지)
    config/               site(사이트 상수·SNS), routes(앱 경로)
    utils/                env-flags(운영/테스트 환경 판정)
    types.ts              UserProfile, ContactSubmission
functions/
  index.js                onUserSignup, onContactCreated + Channel Talk 함수 export
  gmail-notify.js         관리자·회원 메일 발송 큐
  channeltalk/            Channel Talk 접수 연동(트리거·재시도·내부 대화·lastContactAt·V2 이전 도구)
  scripts/                Channel Talk 운영 스크립트(수동 실행)
  test/                   Functions 단위 테스트
tests/
  analytics/ channel-talk/ kakaowork/ rules/   기능별 테스트 (rules는 Firestore Emulator)
  esm-alias-loader.mjs    테스트용 "@/" 별칭 리졸버
docs/
  operations/             운영·배포 (Functions 배포 가이드, 컬렉션·메일, dev → 운영 전환 마스터 문서)
  integrations/           외부 연동 (Channel Talk V2, Meta Pixel)
  plans/                  설계·계획 (운영 전환 체크리스트 포함)
```

## 유지 기능과 위치

| 기능 | 웹 | 서버 |
|---|---|---|
| 로그인·회원가입 | `components/auth`, `lib/auth`, `lib/firebase/firestore-service.ts` | `onUserSignup`, `channelTalkOnUserCreated` |
| Contact 문의 | `components/contact`, `lib/firebase/firestore-service.ts`, `lib/channel-talk/intake.ts` | `onContactCreated`(관리자 메일), `channelTalkOnContactCreated`(상담·내부 대화), `channelTalkRetry` |
| Channel Talk 위젯 | `components/channel-talk`, `lib/channel-talk/client.ts`, `app/api/channel-talk` | `channelTalkLastContactWebhook` |
| GA4·Meta Pixel | `components/analytics`, `lib/analytics` | — |
| KakaoWork Git 알림 | `.github/workflows`, `.github/scripts` | — |

운영 전환 작업은 [plans/website-renewal-production-cutover.md](plans/website-renewal-production-cutover.md)를 따른다.

## Figma 최종 디자인 ↔ 코드 위치

기준: Figma `Medidakos Website Renewal _ Wireframe` → 페이지 `Website Design — Desktop`(1440px). 한국어 프레임은 내부 참고용이며 영어 버전만 구현한다.

| 페이지 (Figma 프레임) | 라우트 | 섹션 | 컴포넌트 위치 |
|---|---|---|---|
| Home — Final Design | `/` | Hero, Key Metrics, Partner Certifications, Why Medidakos, Product Categories(7개 타일 → `/portfolio?category=`), SNS Content(Instagram·TikTok 탭 + 가로 캐러셀 + 게시물 모달), Client Testimonials(세계 지도 핀 + 후기 카드, 지도는 SVG), CTA Band | `components/home/` |
| About Us — Final Design | `/about-us` | Hero, The Challenge, Transition, Why Medidakos → Our Approach, Who We Are & Company Information, CTA Band | `components/about/` |
| Services — Final Design | `/services` (예정) | Hero, 앵커 바(sticky), Scope `#scope`, How It Works `#how-it-works`(9단계 sticky 내비), Samples & MOQ `#samples-moq`, Payment & Shipping `#payment-shipping`, Quality & Compliance `#quality-compliance`, CTA Band | `components/services/` |
| Portfolio — Final Design (+ 카테고리별 7개 프레임) | `/portfolio`, `?category=` (예정) | Hero, 카테고리 필터 + 제품 그리드(3열, Load more), CTA Band(Brief template 다운로드) | `components/portfolio/` |
| FAQ — Final Design | `/faq` (예정) | Hero, 토픽 내비(sticky, `#moq` 등 7개) + 아코디언 그룹, Contact CTA | `components/faq/` |
| Contact — Final Design | `/contact` | Hero, 문의 폼(필수·선택·Brief 업로드), 사이드(프로모션 안내 `?promo=`, 다음 단계, 연락 채널) | `components/contact/` |
| Privacy Policy / Terms of Service | URL 미정 | Header, 목차(sticky) + 본문 | `components/legal/` |
| Log In / Sign Up | `/login`, Sign Up URL 미정 | Auth 카드(Google, 이메일 필드) | `components/auth/` |
| Dashboard | 2차 개발 | — | — |

공통 요소

| 요소 | 사용 범위 | 위치 |
|---|---|---|
| Navbar (활성 메뉴 × 로그인 상태 변형) | 전 페이지 | `components/layout/Header.tsx` |
| Announcement Bar | Home, About Us, Services, Portfolio, FAQ (Contact·정책·Auth 제외) | `components/layout/` |
| Footer (Services·Company·Follow 링크, 법적 링크, Cookie Settings) | Auth·Dashboard 제외 전 페이지 | `components/layout/Footer.tsx` |
| Cookie Banner·Cookie Settings Modal | 전 페이지 | `components/cookie-consent/` |
| Channel Talk 런처·패널 | 전 페이지(디자인은 자리표시, 실제는 SDK 위젯) | `components/channel-talk/` |
| Button, Tag, Filter Chip, Input, Select, Textarea, Checkbox, Upload Dropzone, Form Message, Accordion | 여러 페이지 | `components/ui/` |
| CTA Band | 대부분 페이지 하단(페이지마다 문구·버튼 다름) | 페이지 폴더. 같은 형태가 확인되면 `components/ui/`로 올린다 |
| Product Card, Category Tile, Cert Mark, SNS Post, Map Pin·Map Testimonial Card, Policy TOC Item | 해당 페이지 전용 | 각 페이지 폴더 |

구현 전 확인 필요(디자인에 정보 없음)
- Privacy Policy·Terms·Sign Up의 URL
- Contact 폼의 새 필드(선택 항목, Brief 파일 업로드)는 Firestore `contact` 규칙·Storage 규칙·Channel Talk 내부 대화 양식 변경이 필요하다. 데이터 모양과 규칙안을 먼저 승인받는다.
- 쿠키 동의 도입 시 GA4·Meta Pixel 로드 조건(동의 전 미로드)을 함께 정한다.
- 카테고리 이름·개수가 화면마다 다르다. Home 타일은 Facial care, Cleansing, Mask/Pad, Sun care, Body care, Hair care, Makeup이고, Portfolio 필터 칩은 All, Skincare, Cleanser, Mask, Sun Care, Lip Care, Body Care, Hair Care(프레임 이름은 "All + 11 categories")다. 제품·카테고리 데이터 기준을 먼저 정한다.

