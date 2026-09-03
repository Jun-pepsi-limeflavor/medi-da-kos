/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  buildNotificationMime,
  encodeRawMessage,
  getNotifyToken,
  normalizeNotifyRecipients,
  queueAndSendEmail,
  sendNotification,
} = require("../gmail-notify");

function fakeMailDb(existing = {}) {
  const docs = new Map(Object.entries(existing));
  const writes = [];
  return {
    writes,
    docs,
    collection(name) {
      return {
        doc(id) {
          const key = `${name}/${id}`;
          return {
            async create(data) {
              if (docs.has(key)) {
                const err = new Error("already exists");
                err.code = 6;
                throw err;
              }
              docs.set(key, data);
              writes.push({ type: "create", key, data });
            },
            async get() {
              const data = docs.get(key);
              return { exists: Boolean(data), data: () => data };
            },
            async update(data) {
              const prev = docs.get(key);
              if (!prev) throw new Error("not found");
              const next = { ...prev, ...data };
              docs.set(key, next);
              writes.push({ type: "update", key, data });
            },
          };
        },
      };
    },
  };
}

const payload = {
  to: ["songjh@techasset.co.kr", "parkjy@techasset.co.kr"],
  message: {
    subject: "신규 주문",
    html: "<p>hello</p>",
    text: "hello",
  },
};

test("MIME builder rejects header injection in subject and recipients", () => {
  assert.throws(
    () =>
      buildNotificationMime({
        from: "support@medidakos.com",
        to: ["songjh@techasset.co.kr"],
        subject: "ok\r\nBcc: evil@example.com",
        text: "body",
      }),
    /line break/,
  );
  assert.throws(
    () =>
      buildNotificationMime({
        from: "support@medidakos.com",
        to: ["songjh@techasset.co.kr\nbad@example.com"],
        subject: "ok",
        text: "body",
      }),
    /line break/,
  );
});

test("MIME builder keeps Korean subject as UTF-8 and builds multipart html", () => {
  const raw = buildNotificationMime({
    from: "support@medidakos.com",
    to: ["songjh@techasset.co.kr", "parkjy@techasset.co.kr"],
    subject: "[문의] 신규 주문",
    text: "plain",
    html: "<p>html</p>",
    boundary: "test-boundary",
  });
  assert.match(raw, /Subject: \[문의\] 신규 주문/);
  assert.doesNotMatch(raw, /=\?UTF-8\?B\?/);
  assert.match(raw, /To: songjh@techasset\.co\.kr, parkjy@techasset\.co\.kr/);
  assert.match(raw, /multipart\/alternative; boundary="test-boundary"/);
  assert.match(raw, /text\/plain; charset=UTF-8/);
  assert.match(raw, /text\/html; charset=UTF-8/);
  assert.match(raw, /--test-boundary--/);
});

test("MIME builder falls back to stripped html when text is missing", () => {
  const raw = buildNotificationMime({
    from: "support@medidakos.com",
    to: "songjh@techasset.co.kr",
    subject: "Hello",
    html: "<p>Please use <b>vegan</b></p>",
    boundary: "x",
  });
  const plainB64 = Buffer.from("Please use vegan", "utf8").toString("base64");
  assert.ok(raw.includes(plainB64));
});

test("normalizeNotifyRecipients rejects an empty list", () => {
  assert.throws(() => normalizeNotifyRecipients([]), /at least one recipient/);
});

test("getNotifyToken rejects an unapproved from address without calling IAM", async () => {
  await assert.rejects(
    () => getNotifyToken("thomas@medidakoslabs.com"),
    /not approved/,
  );
});

test("sendNotification posts raw RFC 5322 without a threadId", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      async json() {
        return { id: "gmail-1", threadId: "thread-1" };
      },
    };
  };
  const result = await sendNotification({
    token: "tok",
    from: "support@medidakos.com",
    to: ["songjh@techasset.co.kr"],
    subject: "Hi",
    text: "body",
    fetchImpl,
  });
  assert.equal(result.id, "gmail-1");
  assert.equal(calls.length, 1);
  const body = JSON.parse(calls[0].init.body);
  assert.equal("threadId" in body, false);
  const mime = Buffer.from(body.raw, "base64url").toString("utf8");
  assert.match(mime, /^From: support@medidakos.com/m);
  encodeRawMessage(mime);
});

test("queueAndSendEmail skips send when delivery is already SUCCESS", async () => {
  const db = fakeMailDb({
    "mail/order_admin_1": {
      to: payload.to,
      message: payload.message,
      delivery: { state: "SUCCESS", info: "already" },
    },
  });
  let sent = 0;
  const result = await queueAndSendEmail({
    db,
    docId: "order_admin_1",
    payload,
    from: "support@medidakos.com",
    send: async () => {
      sent += 1;
      return { id: "new" };
    },
  });
  assert.equal(result.skipped, true);
  assert.equal(sent, 0);
  assert.equal(db.writes.length, 0);
});

test("queueAndSendEmail retries PENDING and ERROR then records SUCCESS", async () => {
  for (const state of ["PENDING", "ERROR"]) {
    const db = fakeMailDb({
      "mail/order_admin_retry": {
        to: payload.to,
        message: payload.message,
        delivery: { state, startTime: "2026-09-03T00:00:00.000Z" },
      },
    });
    let sent = 0;
    const result = await queueAndSendEmail({
      db,
      docId: "order_admin_retry",
      payload,
      from: "support@medidakos.com",
      send: async () => {
        sent += 1;
        return { id: `gmail-${state}` };
      },
      now: () => "2026-09-03T01:00:00.000Z",
    });
    assert.equal(result.skipped, false);
    assert.equal(sent, 1);
    const stored = db.docs.get("mail/order_admin_retry");
    assert.equal(stored.delivery.state, "SUCCESS");
    assert.equal(stored.delivery.info, `gmail-${state}`);
  }
});

test("queueAndSendEmail creates a PENDING reservation then SUCCESS on first send", async () => {
  const db = fakeMailDb();
  await queueAndSendEmail({
    db,
    docId: "signup_admin_1",
    payload,
    from: "support@medidakos.com",
    send: async () => ({ id: "gmail-new" }),
    now: () => "2026-09-03T02:00:00.000Z",
  });
  const stored = db.docs.get("mail/signup_admin_1");
  assert.equal(stored.delivery.state, "SUCCESS");
  assert.equal(stored.delivery.info, "gmail-new");
  assert.equal(db.writes[0].type, "create");
  assert.equal(db.writes[0].data.delivery.state, "PENDING");
});

test("queueAndSendEmail records ERROR and rethrows when send fails", async () => {
  const db = fakeMailDb();
  await assert.rejects(
    () =>
      queueAndSendEmail({
        db,
        docId: "contact_admin_fail",
        payload,
        from: "support@medidakos.com",
        send: async () => {
          throw new Error("Gmail 발송 실패 401");
        },
        now: () => "2026-09-03T03:00:00.000Z",
      }),
    /Gmail 발송 실패 401/,
  );
  const stored = db.docs.get("mail/contact_admin_fail");
  assert.equal(stored.delivery.state, "ERROR");
  assert.equal(stored.delivery.error, "Gmail send failed");
});

test("queueAndSendEmail rejects an unapproved from address", async () => {
  const db = fakeMailDb();
  await assert.rejects(
    () =>
      queueAndSendEmail({
        db,
        docId: "nope",
        payload,
        from: "hally@medidakoslabs.com",
        send: async () => ({ id: "x" }),
      }),
    /not approved/,
  );
  assert.equal(db.writes.length, 0);
});
