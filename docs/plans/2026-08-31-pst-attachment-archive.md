# PST 첨부 아카이브 계획

## 목적과 범위

`support@medidakos.com.pst`의 **실제 첨부 바이너리**를 Firebase Storage에 한 번 보관하고, 기존 Gmail 첨부와 같은 관리자 화면에서 열고 다운로드한다.

- 대상: 이번 PST에서 추출한 실제 첨부만.
- 제외: Gmail 첨부의 Storage 복제, Outlook/Channel Talk의 실시간 첨부 복제, 고객 클라이언트 직접 접근, OCR·바이러스 검사·미리보기 변환.
- Outlook RTF 본문 변환용 `rtf-body.rtf`는 첨부가 아니라 본문으로 처리하므로 업로드하지 않는다.

기존 원칙인 “Gmail 첨부는 제공자 API 프록시로 읽고 Storage에 복제하지 않는다”는 유지한다. PST는 원본 제공자에서 다시 읽을 수 없는 아카이브이므로 이 원칙의 좁은 예외다.

## 현재 계약과 재사용

- Gmail 수집기는 `attachments[]`에 `filename`, `mimeType`, `size`, `attachmentId`만 저장한다.
- 관리자 UI는 이미지 첨부를 갤러리·확대보기로, 나머지를 파일명·크기·다운로드 링크로 표시한다.
- 관리자 첨부 라우트는 `withAdmin` 뒤에서 Gmail API의 바이너리를 스트리밍한다.

따라서 새 화면이나 별도 파일 목록을 만들지 않는다. PST 첨부가 Storage에 있음을 메타데이터로 구분하고, 같은 첨부 라우트가 Gmail 또는 Storage 원본을 선택하게 한다.

## 승인할 데이터·권한 계약

### Firestore 메시지 메타데이터

기존 `attachments[]`의 필수 필드는 보존하고, 다음 선택 필드를 추가한다.

```ts
{
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
  delivery?: "gmail_proxy" | "storage_archive";
  storagePath?: string; // Storage 내부 식별자. 공개 URL이 아님.
  sha256?: string;      // 업로드한 바이트의 무결성 검증값
  archiveStatus?: "archived" | "failed";
}
```

- 기존 Gmail 레코드는 선택 필드 없이 그대로 유효하며, 동작은 변하지 않는다.
- PST에서 `archiveStatus: "archived"`인 항목만 화면에서 열 수 있다.
- 실패한 항목은 메타데이터와 오류 보고서에 남기되, 성공한 첨부처럼 보이거나 다운로드 링크를 만들지 않는다.
- Firestore에는 파일 바이트, 공개 다운로드 URL, 고객의 민감한 본문을 추가하지 않는다.

### Storage와 접근 제어

Storage 객체 경로는 파일명·이메일 주소가 아닌 결정적 식별자를 쓴다.

```text
mail-archives/outlook-support/{messageDocIdHash}/{attachmentIdHash}
```

- Storage Rules: 기본 `read`, `write` 모두 거부한다.
- 업로드: 로컬 PST importer가 Firebase Admin 자격증명으로만 수행한다.
- 다운로드/인라인 표시: 기존 `GET /api/admin/messages/{id}/attachments/{attId}`가 `withAdmin`을 통과한 뒤 Storage에서 스트리밍한다.
- 응답은 `Content-Disposition`의 UTF-8 파일명 처리와 MIME 타입을 유지하고, `Cache-Control: private, no-store`로 둔다.
- Storage 다운로드 토큰이나 공개 URL을 Firestore·브라우저에 저장하지 않는다.

현재 Firebase 설정에는 Storage Rules 배포 대상이 없으므로, 구현 시 `storage.rules`와 명시적 Firebase 설정을 같은 변경에 포함한다.

## 마이그레이션 알고리즘

1. `readpst`가 만든 EML에서 본문과 실제 첨부를 분리한다. RTF 본문 가짜 첨부는 제외한다.
2. 각 첨부 바이트를 임시 파일 대신 스트림으로 읽고 `size`, SHA-256을 계산한다.
3. `--dry-run`은 메시지별 첨부 수·총량·형식·최대 크기·RTF 제외 수·예상 Storage 경로만 보고한다. 네트워크·Firestore·Storage 쓰기는 없다.
4. `--apply`는 결정적 Storage 경로에 업로드한다. 이미 같은 SHA-256 객체가 있으면 재사용하고, 경로는 같지만 SHA-256이 다르면 즉시 실패한다.
5. 한 메시지의 모든 첨부가 `archived`가 된 뒤에만 `saveMessage()`로 해당 메시지와 첨부 메타데이터를 저장한다.
6. 재실행은 같은 경로·해시를 재사용하므로 멱등이다. Storage와 Firestore는 원자 트랜잭션을 공유하지 않으므로, Firestore 쓰기 실패 뒤 남은 객체는 실행 보고서에 `orphanCandidate`로 기록한다. 자동 삭제하지 않는다.

## 화면·라우트 변경

`MessageMediaGallery`의 현재 `isGmail` 분기는 제공자 이름이 아니라 “다운로드 가능 여부”로 바꾼다.

| 원본 | 파일 바이트 위치 | 관리자 라우트 동작 | 화면 |
|---|---|---|---|
| Gmail | Gmail API | 기존 Gmail attachment API 호출 | 현재와 동일 |
| PST | Firebase Storage 비공개 객체 | Admin SDK로 객체 스트리밍 | 현재와 동일 |
| 메타데이터만/실패 | 없음 | 404가 아니라 다운로드 불가 상태 | 파일 칩 + 상태 |

이미지는 같은 URL로 `<img>`와 라이트박스를 사용하고, PDF·Office 파일은 기존 다운로드 링크를 사용한다. 파일 형식별 새 뷰어는 만들지 않는다.

## 검증과 완료 기준

### 자동 테스트

- 첨부 스키마의 기존 Gmail 호환성과 PST Storage 필드 검증
- EML의 PDF·이미지·빈 파일명·한글 파일명·실제 RTF 본문 케이스
- 업로드 바이트의 SHA-256·크기 검증, 같은 입력 재실행, 충돌 SHA-256 실패
- `withAdmin` 미인증/비관리자 거부 및 Storage 직접 읽기 거부
- Gmail 프록시 회귀와 PST Storage 스트리밍의 `Content-Disposition`/MIME 검증

### 실행 검증

1. PST dry-run 결과에서 `실제 첨부 수 = archived + failed + RTF 제외`가 성립한다.
2. 샘플로 이미지, PDF, Office 파일을 각각 하나 이상 관리자 화면에서 열거나 다운로드한다.
3. 전체 적용 후 Storage 객체 수·Firestore `archiveStatus` 수·실행 보고서 수를 대사한다.
4. 실패가 있으면 정확한 메시지/첨부 식별자·원인·재실행 결과를 남긴다. 누락을 성공으로 간주하지 않는다.

## 구현 순서와 승인 경계

1. 이 문서의 스키마·Storage Rules·PST 전용 예외를 승인한다.
2. 코드와 테스트를 구현하고, 실제 PST는 `--dry-run`으로 첨부 인벤토리만 생성한다.
3. 인벤토리(개수·용량·형식·실패 예상)를 검토받는다.
4. 명시적 승인 후 `--apply`로 Storage와 Firestore에 쓴다.
5. 명시적 승인 후에만 Storage Rules와 웹/함수 배포를 수행한다.

이 계획은 커밋, 배포, 실제 Storage/Firestore 쓰기를 승인하지 않는다.
