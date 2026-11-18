# Contact 브리프 → Google 공유 드라이브

Contact 폼(`/contact`)의 "Have a brief?" 첨부 파일을 사내 공유 드라이브에 문의 건별 폴더로 보관한다. 텍스트는 기존처럼 Firestore `contact`에 저장한다(2026-11 도입).

## 흐름

```text
브라우저 ─① contact/{id} 생성(텍스트 + briefFiles 선언)──▶ Firestore
   │                                                   └─▶ onContactCreated: Drive 폴더 생성 → 관리자 메일(폴더 링크)
   └─② 파일 업로드 contact-briefs/{id}/{0|1|2} ─────────▶ Storage(임시)
                                                       └─▶ onContactBriefUploaded: 검사 → Drive 업로드 → briefArchive 기록 → 임시 파일 삭제
```

- 파일당 50 MB, 최대 3개, PDF·DOCX·XLSX·PPTX·JPG·PNG.
- 문의 저장 후 업로드하므로 업로드가 실패해도 문의는 접수된다. 완료 화면에 실패 파일과 `support@medidakos.com` 안내를 보여 준다.

## Drive 폴더 구조

```text
<루트> / [_test /] YYYY / YYYY-MM / YYYY-MM-DD_{회사명}_{contactId 앞 8자} / 01_{원본 파일명}
```

- 날짜는 KST(문의 `serverCreatedAt`). `isTest` 문의(운영 도메인 외 제출)는 `_test` 아래. dev는 전부 `_test`다.
- 문의 폴더에는 `appProperties.contactId`, 파일에는 `contactId`·`briefIndex`가 있다(재시도 시 중복 방지·역추적).
- 기준 데이터는 Firestore다. 폴더 이름을 바꾸거나 옮겨도 ID 기반이라 동작에는 영향이 없다.

## 데이터

`contact/{id}` (규칙: `firestore.rules`의 `validBriefFile`·`validBriefFiles`)

| 필드 | 쓰는 쪽 | 내용 |
|---|---|---|
| `briefFiles` | 브라우저(create) | `[{ name, size, contentType }]` 1~3개. 확장자로 정한 형식 6종, 1 B~50 MB |
| `briefArchive` | Functions만 | `status`(`pending`·`completed`·`partial`·`failed`), `folderId`, `folderUrl`, `files: { "0": { name, size, contentType, status, driveFileId, driveUrl, error?, archivedAt } }`, `updatedAt` |

`folderClaimedAt`은 폴더 생성 중 표시다(2분 지나면 무효). 문의 생성 함수와 파일 함수가 동시에 폴더를 만들지 않게 한다.

Storage `contact-briefs/{contactId}/{0|1|2}` (규칙: `storage.rules`): 새로 만들기만 허용. contact 문서가 리뉴얼 형식이고 생성 30분 이내이며 `briefFiles[번호]`와 크기·형식이 같아야 한다. 읽기·목록·삭제는 누구도 못 한다.

## 임시 파일 삭제

| 경우 | 삭제 |
|---|---|
| Drive 업로드 성공, 이미 보관된 파일, 내용이 형식과 다름(`content_mismatch`) | 함수가 즉시 |
| Drive 영구 오류(권한 등), 1시간 재시도 후 실패 | 남겨 둠 → 버킷 lifecycle `contact-briefs/` 7일 |

버킷 soft delete(7일)로 삭제 후에도 7일간 복구할 수 있다.

## 설정 (dev·prod 각각, 2026-11-17 완료)

| 항목 | dev (`dev-medidakos-b9b4f`) | prod (`medidakos`) |
|---|---|---|
| Drive 루트 `DRIVE_BRIEF_ROOT_FOLDER_ID` | `0AJPAP8SeCFtwUk9PVA` | `1O29BNtJlPKqet0UF38PMDlnNGV_EWpIm` |
| 파라미터 파일 (Git 추적) | `functions/.env.dev-medidakos-b9b4f` | `functions/.env.medidakos` |
| 버킷 (asia-northeast3) | `dev-medidakos-b9b4f.firebasestorage.app` | `medidakos.firebasestorage.app` |
| 웹 버킷 변수 `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Vercel Preview, 로컬 `.env.development.local` | Vercel Production |

권한 (키 파일 없음):

1. Drive API 활성화.
2. 서비스 계정 `drive-archiver@<project>.iam.gserviceaccount.com` (키 생성 금지).
3. 함수 실행 계정 `<프로젝트번호>-compute@developer.gserviceaccount.com`에 `drive-archiver`의 `roles/iam.serviceAccountTokenCreator`. 함수는 이 계정을 대리해 Drive 토큰을 받는다.
4. 공유 드라이브(루트)에 `drive-archiver`를 **콘텐츠 관리자**로 추가. 서비스 계정은 저장 용량이 없어 "내 드라이브" 폴더에는 올릴 수 없다. 콘텐츠 관리자는 영구 삭제를 못 한다(코드도 삭제하지 않는다).
5. 버킷 lifecycle: `{"rule":[{"action":{"type":"Delete"},"condition":{"age":7,"matchesPrefix":["contact-briefs/"]}}]}`.
6. Storage 규칙 첫 배포 때 Firebase CLI가 묻는 교차 서비스 IAM 역할 부여에 **Y**(Storage 규칙의 `firestore.get`에 필요).

접근 확인: 본인 계정에 `drive-archiver` 토큰 생성 권한을 잠시 주고 `gcloud auth print-access-token --impersonate-service-account=drive-archiver@<project>.iam.gserviceaccount.com --scopes=https://www.googleapis.com/auth/drive`로 루트를 조회(`driveId`가 있어야 공유 드라이브) → 확인 후 권한 회수.

## 코드

| 위치 | 역할 |
|---|---|
| `src/components/contact/InquiryForm.tsx`, `BriefUpload.tsx`, `inquiry-validation.ts` | 선택·검증·진행률·완료/실패 안내, `toBriefFileMeta` |
| `src/lib/firebase/firestore-service.ts` (`submitInquiry`), `storage-service.ts` | id 선발급 저장, Storage 업로드 |
| `functions/drive/naming.js` · `client.js` · `archive.js` · `triggers.js` | 이름 규칙, Drive REST(대리 인증·resumable 업로드), 보관 처리, 트리거 |
| `functions/index.js` (`onContactCreated`), `functions/contact-email.js` | 폴더 먼저 생성 후 관리자 메일에 브리프·폴더 링크 |

`onContactBriefUploaded`: 기본 버킷 finalize, 1 GiB, 동시 처리 4, 300초, 재시도 켜짐. Drive 429·5xx·네트워크 오류와 폴더 생성 대기만 재시도하고, 이벤트 1시간이 지나면 `failed`로 기록하고 멈춘다.

## 배포

선택 배포만 한다(`docs/operations/firebase-functions-deployment.md`). 순서: 규칙 → 함수 → 웹(웹이 먼저 나가면 업로드가 규칙에 막힌다).

```bash
firebase deploy -P <dev|prod> --only firestore:rules,storage
firebase deploy -P <dev|prod> --only functions:default:onContactCreated,functions:default:onContactBriefUploaded
```

## 확인·장애 대응

```bash
# 실행 시간(LATENCY)·상태(204 정상, 500 재시도)
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="oncontactbriefuploaded" AND logName:"run.googleapis.com%2Frequests"' --project <project> --freshness=3h --limit 20 --format='table(timestamp, httpRequest.status, httpRequest.latency)'
# 파일별 결과(uploaded·content-mismatch·failed·already-archived)
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="oncontactbriefuploaded" AND textPayload:"contact brief"' --project <project> --freshness=3h --limit 20 --format='table(timestamp, textPayload)'
# 남아 있는 임시 파일
gcloud storage ls -l "gs://<bucket>/contact-briefs/**"
```

- `RetryLater: … folder is being created` ERROR 로그는 정상이다(다른 함수가 폴더를 만드는 중이라 재시도). 몇 초 뒤 같은 파일이 `uploaded`면 문제없다.
- 메일에 "폴더를 아직 만들지 못했습니다"가 보이면 `contact/{id}.briefArchive`와 `oncontactcreated` 로그를 본다. 파일 함수가 폴더를 다시 만든다.
- `briefArchive.files.N.status == "failed"`: `error`를 확인한다. 권한 오류면 설정 4를 고친 뒤, 남아 있는 임시 파일을 같은 경로에 다시 쓰면(관리자 계정으로 `gcloud storage cp`) 트리거가 다시 처리한다. 7일이 지나면 고객에게 파일을 다시 받는다.
