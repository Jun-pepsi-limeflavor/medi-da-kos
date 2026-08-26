@AGENTS.md

# Claude Code 전용

위 `AGENTS.md`가 이 저장소의 지침 본체다. 아래는 Claude Code에서만 다른 부분이다.

## 상위 문서가 함께 로드된다

이 폴더는 `/Users/giwook/Documents/Medidakos backoffice/` 안에 있다. 상위의 `CLAUDE.md`·`AGENTS.md`가 같이 읽히고, **원칙은 상위가 정한다.** 어긋나면 상위가 이긴다.

**2026-08-26에 볼트(`~/Documents/한국기술자산`) 밖으로 옮겼다.** 예전 경로를 참조하는 문서나 스크립트가 남아 있으면 그게 오래된 것이다.

## 글쓰기

코드 주석·커밋 메시지·문서에 「축」·「레이어」·「승급」·「재발사」를 쓰지 않는다. 영어 약어는 풀어 쓴다. 과하게 기획하지 않는다 — 문서는 다음 사람이 일하는 데 필요한 만큼만 쓴다.

## 브라우저 확인

`preview_start`로 띄우고 화면을 본다. 실패하면 `getcwd: Operation not permitted`가 뜨는데, **이건 볼트 안에 있을 때의 증상이었다.** 옮긴 뒤로 다시 시도해본 적이 없으니 먼저 해보고 판단한다.

안 되면 사용자에게 실행을 요청한다.

```bash
cd "/Users/giwook/Documents/Medidakos backoffice/medi-da-kos" && npm run dev
```

그다음 `mcp__aside__repl`로 붙어서 `snapshot(page)`로 읽는다. 2026-08-21 프로토타입 점검에서 검증된 경로다.

둘 다 안 되면 `npm test` · `npm run typecheck` · `npm run lint`로 대체하고 **화면 확인은 안 했다고 명시한다.**

## 의존성 문서

Next 16·React 19·Tailwind v4·Firebase SDK 12는 학습 시점보다 뒤다. 기억으로 API를 쓰지 말고 `node_modules/`를 직접 읽거나 `context7`을 먼저 본다.

이번 세션에서 실측으로 확인된 것들 — `cookies()`는 **비동기**다(`Promise<ReadonlyRequestCookies>`). `node --test`는 `.ts` 확장자를 **요구**하고 `tsc`는 `allowImportingTsExtensions` 없이는 그걸 **거부**한다. `server-only`는 Next에 딸려오지 않는 별도 패키지다.

## 작업 방식

- `docs/backoffice-spec.md`(v2)에 이미 정해진 것을 다시 기획하지 않는다. 9장 작업 순서를 따르고, 순서를 바꿔야 하면 이유를 한 줄로 말하고 진행한다
- 구현은 `docs/plans/`의 계획을 따른다. 계획에 없는 걸 만들지 않는다
- 보안 규칙·컬렉션 구조를 건드리는 변경은 코드를 쓰기 전에 계획을 먼저 보인다
- 임시 스크립트는 스크래치패드에 만들고 세션 끝에 지운다. 저장소에 남기지 않는다
- 커밋·push·배포는 사용자가 요청할 때만 한다
