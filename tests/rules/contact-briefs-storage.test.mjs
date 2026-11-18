import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { Timestamp, doc, setDoc } from "firebase/firestore";
import { getStorageTestEnv } from "./helpers.mjs";

// storage.rules contact-briefs/{contactId}/{fileIndex} — contact 문서의 briefFiles 선언과 대조한다.

const PDF = "application/pdf";
const PNG = "image/png";

function contactDoc(over = {}) {
  return {
    formVersion: 2,
    companyName: "Acme Beauty",
    email: "jane@acme.example",
    status: "submitted",
    briefFiles: [
      { name: "brief.pdf", size: 10, contentType: PDF },
      { name: "ref.png", size: 20, contentType: PNG },
    ],
    serverCreatedAt: Timestamp.now(),
    ...over,
  };
}

/** 규칙을 끈 상태로 contact 문서를 만들고 id를 돌려준다. */
async function seedContact(env, data = contactDoc()) {
  const id = randomUUID();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "contact", id), data);
  });
  return id;
}

function upload(ctx, path, size, contentType) {
  return Promise.resolve(ctx.storage().ref(path).put(new Uint8Array(size), { contentType }));
}

const anon = (env) => env.unauthenticatedContext();

test("Storage: 선언과 같은 크기·형식이면 비로그인으로 업로드할 수 있다", async () => {
  const env = await getStorageTestEnv();
  const id = await seedContact(env);
  await assertSucceeds(upload(anon(env), `contact-briefs/${id}/0`, 10, PDF));
  await assertSucceeds(upload(anon(env), `contact-briefs/${id}/1`, 20, PNG));
});

test("Storage: 크기나 형식이 선언과 다르면 거부한다", async () => {
  const env = await getStorageTestEnv();
  const id = await seedContact(env);
  await assertFails(upload(anon(env), `contact-briefs/${id}/0`, 11, PDF));
  await assertFails(upload(anon(env), `contact-briefs/${id}/0`, 10, PNG));
  await assertFails(upload(anon(env), `contact-briefs/${id}/1`, 10, PDF));
});

test("Storage: 선언 개수를 넘는 번호나 잘못된 파일 이름을 거부한다", async () => {
  const env = await getStorageTestEnv();
  const id = await seedContact(env);
  await assertFails(upload(anon(env), `contact-briefs/${id}/2`, 10, PDF));
  await assertFails(upload(anon(env), `contact-briefs/${id}/3`, 10, PDF));
  await assertFails(upload(anon(env), `contact-briefs/${id}/brief.pdf`, 10, PDF));
  await assertFails(upload(anon(env), `contact-briefs/${id}/0/x`, 10, PDF));
});

test("Storage: contact 문서가 없거나, 리뉴얼 형식이 아니거나, 첨부 선언이 없으면 거부한다", async () => {
  const env = await getStorageTestEnv();
  await assertFails(upload(anon(env), `contact-briefs/${randomUUID()}/0`, 10, PDF));
  const legacy = contactDoc();
  delete legacy.formVersion;
  await assertFails(upload(anon(env), `contact-briefs/${await seedContact(env, legacy)}/0`, 10, PDF));
  const noFiles = contactDoc();
  delete noFiles.briefFiles;
  await assertFails(upload(anon(env), `contact-briefs/${await seedContact(env, noFiles)}/0`, 10, PDF));
});

test("Storage: 문의 생성 30분이 지나면 거부한다", async () => {
  const env = await getStorageTestEnv();
  const old = Timestamp.fromMillis(Date.now() - 31 * 60 * 1000);
  const id = await seedContact(env, contactDoc({ serverCreatedAt: old }));
  await assertFails(upload(anon(env), `contact-briefs/${id}/0`, 10, PDF));
});

test("Storage: 이미 올라간 파일을 덮어쓸 수 없다", async () => {
  const env = await getStorageTestEnv();
  const id = await seedContact(env);
  await assertSucceeds(upload(anon(env), `contact-briefs/${id}/0`, 10, PDF));
  await assertFails(upload(anon(env), `contact-briefs/${id}/0`, 10, PDF));
});

test("Storage: 업로드한 파일을 읽기·목록·삭제할 수 없다(로그인해도)", async () => {
  const env = await getStorageTestEnv();
  const id = await seedContact(env);
  await assertSucceeds(upload(anon(env), `contact-briefs/${id}/0`, 10, PDF));
  for (const ctx of [anon(env), env.authenticatedContext("buyer-1")]) {
    const ref = ctx.storage().ref(`contact-briefs/${id}/0`);
    await assertFails(ref.getDownloadURL());
    await assertFails(ref.getMetadata());
    await assertFails(ctx.storage().ref(`contact-briefs/${id}`).listAll());
    await assertFails(ref.delete());
  }
});

test("Storage: 다른 경로는 모두 거부한다", async () => {
  const env = await getStorageTestEnv();
  await assertFails(upload(anon(env), "anything.pdf", 10, PDF));
  await assertFails(upload(env.authenticatedContext("buyer-1"), "users/buyer-1/a.pdf", 10, PDF));
});
