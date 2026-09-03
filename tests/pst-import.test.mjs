import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { test } from "node:test";
import { parseArgs, readJsonl, readpstArgs } from "../scripts/import-pst.mjs";

const parser = join(process.cwd(), "scripts", "pst-to-jsonl.py");

function runParser(exportDir, output, mailbox, options = []) {
  return new Promise((resolve, reject) => {
    const child = spawn("python3", [parser, exportDir, "--mailbox", mailbox, "--output", output, ...options]);
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(stderr) : reject(new Error(stderr)));
  });
}

test("PST EML conversion preserves the shared message contract and deterministic IDs", async () => {
  const root = await mkdtemp(join(tmpdir(), "medidakos-pst-test-"));
  try {
    const exportDir = join(root, "export");
    const output = join(root, "messages.jsonl");
    const eml = [
      "From: Buyer <buyer@example.test>",
      "To: support@example.test",
      "Subject: =?utf-8?b?7JWI64WV?= request",
      "Date: Mon, 31 Aug 2026 10:00:00 +0900",
      "Message-ID: <pst-1@example.test>",
      "Thread-Index: AAAAAAAAAAAAAAAAAAAAAA==",
      "MIME-Version: 1.0",
      "Content-Type: multipart/mixed; boundary=boundary",
      "",
      "--boundary",
      "Content-Type: text/plain; charset=utf-8",
      "",
      "Hello from the buyer.",
      "--boundary",
      "Content-Type: application/pdf",
      "Content-Disposition: attachment; filename=brief.pdf",
      "Content-Transfer-Encoding: base64",
      "",
      "SGVsbG8=",
      "--boundary--",
      "",
    ].join("\r\n");
    await mkdir(join(exportDir, "Inbox"), { recursive: true });
    await writeFile(join(exportDir, "Inbox", "1.eml"), eml);
    await runParser(exportDir, output, "support@example.test");
    const [message] = (await readFile(output, "utf8")).trim().split("\n").map(JSON.parse);

    assert.equal(message.channel, "outlook_support");
    assert.equal(message.sourceAccount, "support@example.test");
    assert.equal(message.direction, "in");
    assert.equal(message.from, "buyer@example.test");
    assert.equal(message.subject, "안녕 request");
    assert.match(message.bodyText, /Hello from the buyer/);
    assert.deepEqual(message.attachments, [{
      filename: "brief.pdf",
      mimeType: "application/pdf",
      size: 5,
      attachmentId: message.attachments[0].attachmentId,
    }]);
    assert.match(message.threadKey, /^outlook_support:support@example\.test:pst-thread-index:/);
    assert.equal(message.sentAt, "2026-08-31T01:00:00.000Z");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("PST importer requires an explicit mailbox and apply flag is opt-in", () => {
  assert.throws(() => parseArgs(["support.pst"]), /PST file and --mailbox are required/);
  const parsed = parseArgs(["support.pst", "--mailbox", "support@example.test"]);
  assert.equal(parsed.apply, false);
  assert.equal(parsed.sentOnly, false);
  assert.equal(parseArgs(["support.pst", "--mailbox", "support@example.test", "--sent-only"]).sentOnly, true);
  assert.deepEqual(readpstArgs("/tmp/support.pst", "/tmp/export"), [
    "-e", "-8", "-q", "-t", "e", "-o", "/tmp/export", "/tmp/support.pst",
  ]);
});

test("PST sent-only conversion restores Outlook display-name recipients", async () => {
  const root = await mkdtemp(join(tmpdir(), "medidakos-pst-sent-test-"));
  try {
    const exportDir = join(root, "export");
    const output = join(root, "messages.jsonl");
    const headers = (from, to, subject, id) => [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      "Date: Mon, 31 Aug 2026 10:00:00 +0900",
      `Message-ID: <${id}@example.test>`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      "Message body.",
    ].join("\r\n");
    await mkdir(join(exportDir, "받은 편지함"), { recursive: true });
    await mkdir(join(exportDir, "보낸 편지함"), { recursive: true });
    await writeFile(join(exportDir, "받은 편지함", "1.eml"), headers("Buyer <buyer@example.test>", "Support", "Request", "in-1"));
    await writeFile(join(exportDir, "보낸 편지함", "2.eml"), headers("Support <MAILER-DAEMON>", "Buyer", "Re: Request", "out-1"));

    await runParser(exportDir, output, "support@example.test", ["--sent-only"]);
    const messages = (await readFile(output, "utf8")).trim().split("\n").map(JSON.parse);

    assert.equal(messages.length, 1);
    assert.equal(messages[0].direction, "out");
    assert.equal(messages[0].from, "support@example.test");
    assert.deepEqual(messages[0].to, ["buyer@example.test"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("PST conversion restores readpst's RTF-only Outlook body instead of treating it as an attachment", async () => {
  const root = await mkdtemp(join(tmpdir(), "medidakos-pst-rtf-test-"));
  try {
    const exportDir = join(root, "export");
    const output = join(root, "messages.jsonl");
    const eml = [
      "From: Buyer <buyer@example.test>",
      "To: support@example.test",
      "Subject: RTF body",
      "Date: Mon, 31 Aug 2026 10:00:00 +0900",
      "Message-ID: <pst-rtf@example.test>",
      "MIME-Version: 1.0",
      "Content-Type: multipart/mixed; boundary=boundary",
      "",
      "--boundary",
      "Content-Type: application/rtf",
      "Content-Disposition: attachment; filename=rtf-body.rtf",
      "",
      "{\\rtf1\\ansi Hello\\par World}",
      "--boundary--",
      "",
    ].join("\r\n");
    await mkdir(exportDir, { recursive: true });
    await writeFile(join(exportDir, "1.eml"), eml);
    await runParser(exportDir, output, "support@example.test");
    const [message] = (await readFile(output, "utf8")).trim().split("\n").map(JSON.parse);

    assert.match(message.bodyText, /Hello/);
    assert.match(message.bodyText, /World/);
    assert.deepEqual(message.attachments, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("PST JSONL reader preserves Unicode line-separator characters in message bodies", async () => {
  const root = await mkdtemp(join(tmpdir(), "medidakos-pst-jsonl-test-"));
  try {
    const output = join(root, "messages.jsonl");
    await writeFile(output, `${JSON.stringify({ bodyText: "first\u2028second" })}\n`);
    assert.deepEqual(await readJsonl(output), [{ bodyText: "first\u2028second" }]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
