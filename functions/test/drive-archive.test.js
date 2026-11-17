/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { archiveStatus, matchesDeclaredType, parseBriefPath } = require("../drive/archive");
const { DriveError, createDriveClient } = require("../drive/client");

const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

test("경로: contact-briefs/{id}/{0-2}만 처리한다", () => {
  assert.deepEqual(parseBriefPath("contact-briefs/abc123/0"), { contactId: "abc123", index: 0 });
  assert.deepEqual(parseBriefPath("contact-briefs/abc123/2"), { contactId: "abc123", index: 2 });
  for (const name of ["contact-briefs/abc/3", "contact-briefs/abc/0/x", "contact-briefs//0", "other/abc/0", "", undefined]) {
    assert.equal(parseBriefPath(name), null, String(name));
  }
});

test("형식 검사: 파일 앞부분이 선언한 형식과 맞아야 한다", () => {
  assert.ok(matchesDeclaredType(Buffer.from("%PDF-1.7 ..."), PDF));
  assert.ok(matchesDeclaredType(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14]), DOCX));
  assert.ok(matchesDeclaredType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg"));
  assert.ok(matchesDeclaredType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]), "image/png"));
  assert.ok(!matchesDeclaredType(Buffer.from("MZ\x90\x00"), PDF)); // .exe renamed to .pdf
  assert.ok(!matchesDeclaredType(Buffer.from("%PDF-1.7"), DOCX));
  assert.ok(!matchesDeclaredType(Buffer.from("%PD"), PDF));
  assert.ok(!matchesDeclaredType(Buffer.from("%PDF-1.7"), "text/html"));
});

test("전체 상태: 모두 처리 전 pending, 전부 성공 completed, 일부 partial, 전부 실패 failed", () => {
  const ok = { status: "uploaded" };
  const bad = { status: "failed" };
  assert.equal(archiveStatus(2, { 0: ok }), "pending");
  assert.equal(archiveStatus(2, { 0: ok, 1: ok }), "completed");
  assert.equal(archiveStatus(3, { 0: ok, 1: bad, 2: ok }), "partial");
  assert.equal(archiveStatus(1, { 0: bad }), "failed");
  assert.equal(archiveStatus(1, undefined), "pending");
});

/** fetch stub: records requests, answers from `responses` in order. */
function stubFetch(responses) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const r = responses.shift() ?? { status: 200, body: {} };
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      headers: new Headers(r.headers || {}),
      json: async () => r.body,
      text: async () => JSON.stringify(r.body),
    };
  };
  return { calls, fetchImpl };
}

const client = (fetchImpl) => createDriveClient({ getToken: async () => "tok", fetchImpl });

test("Drive: 폴더 찾기는 공유 드라이브 옵션·이스케이프된 이름으로, 없으면 만든다", async () => {
  const { calls, fetchImpl } = stubFetch([
    { status: 200, body: { files: [] } },
    { status: 200, body: { id: "new", webViewLink: "https://drive.google.com/drive/folders/new" } },
  ]);
  const folder = await client(fetchImpl).ensureFolder("root", "O'Brien\\Co");
  assert.equal(folder.id, "new");
  const list = new URL(calls[0].url);
  assert.equal(list.searchParams.get("supportsAllDrives"), "true");
  assert.equal(list.searchParams.get("includeItemsFromAllDrives"), "true");
  assert.match(list.searchParams.get("q"), /name = 'O\\'Brien\\\\Co'/);
  assert.equal(calls[0].init.headers.authorization, "Bearer tok");
  assert.equal(calls[1].init.method, "POST");
  assert.deepEqual(JSON.parse(calls[1].init.body), {
    name: "O'Brien\\Co",
    mimeType: "application/vnd.google-apps.folder",
    parents: ["root"],
  });
});

test("Drive: 이미 있으면(가장 오래된 것) 새로 만들지 않는다", async () => {
  const { calls, fetchImpl } = stubFetch([{ status: 200, body: { files: [{ id: "old" }, { id: "dup" }] } }]);
  assert.equal((await client(fetchImpl).ensureFolder("root", "2026")).id, "old");
  assert.equal(calls.length, 1);
  assert.equal(new URL(calls[0].url).searchParams.get("orderBy"), "createdTime");
});

test("Drive: 파일 업로드는 resumable(세션 열기 → 원본 바이트 PUT)", async () => {
  const session = "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=xyz";
  const { calls, fetchImpl } = stubFetch([
    { status: 200, body: {}, headers: { location: session } },
    { status: 200, body: { id: "f1", webViewLink: "https://drive.google.com/file/d/f1" } },
  ]);
  const data = Buffer.from("%PDF-1.7 body");
  const file = await client(fetchImpl).uploadFile({
    parentId: "folder", name: "01_brief.pdf", mimeType: PDF, data, appProperties: { contactId: "c1", briefIndex: "0" },
  });
  assert.equal(file.id, "f1");
  const [open, put] = calls;
  assert.match(open.url, /^https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files\?uploadType=resumable&supportsAllDrives=true/);
  assert.equal(open.init.method, "POST");
  assert.equal(open.init.headers["x-upload-content-type"], PDF);
  assert.equal(open.init.headers["x-upload-content-length"], String(data.length));
  assert.deepEqual(JSON.parse(open.init.body), {
    name: "01_brief.pdf", mimeType: PDF, parents: ["folder"], appProperties: { contactId: "c1", briefIndex: "0" },
  });
  assert.equal(put.url, session);
  assert.equal(put.init.method, "PUT");
  assert.equal(put.init.headers["content-type"], PDF);
  assert.equal(put.init.body, data);
});

test("Drive: 세션 URL이 없으면 재시도 대상 오류", async () => {
  const { fetchImpl } = stubFetch([{ status: 200, body: {} }]);
  await assert.rejects(
    client(fetchImpl).uploadFile({ parentId: "f", name: "a.pdf", mimeType: PDF, data: Buffer.from("%PDF-") }),
    (e) => e instanceof DriveError && e.retryable,
  );
});

test("Drive: 429·5xx·네트워크 오류만 재시도 대상", async () => {
  for (const [status, retryable] of [[429, true], [500, true], [503, true], [403, false], [404, false]]) {
    const { fetchImpl } = stubFetch([{ status, body: { error: "x" } }]);
    await assert.rejects(client(fetchImpl).ensureFolder("root", "a"), (e) => e instanceof DriveError && e.retryable === retryable);
  }
  const failing = async () => { throw new TypeError("fetch failed"); };
  await assert.rejects(client(failing).ensureFolder("root", "a"), (e) => e instanceof DriveError && e.retryable);
});
