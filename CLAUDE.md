@AGENTS.md

# Claude Code 전용

이 파일은 Claude Code 전용 실행 보조 규칙만 둔다. 프로젝트 정책은 `AGENTS.md`가 단일 원본이다.

## 브라우저 확인

UI를 검증할 때 먼저 `preview_start`로 개발 서버를 시작해 화면을 확인한다. 실패하면 사용자가 `npm run dev`로 서버를 실행한 뒤 Aside 세션에 연결할 수 있도록 요청한다.

둘 다 불가능하면 `npm test`, `npm run typecheck`, `npm run lint`를 실행하고 화면 검증을 하지 못했다는 사실을 결과에 밝힌다.

## Claude 설정

`.claude/settings.json`의 destructive-command, cost-leak, touched-file typecheck hook은 프로젝트 방어선이다. 특별한 이유와 사용자 승인이 없으면 우회하거나 제거하지 않는다.

문서와 코드 주석은 필요한 내용만 간결하게 쓴다.
