import { test } from "node:test";
import assert from "node:assert";

/**
 * RFC 5987/6266 filename*= encoding for non-ASCII filenames.
 * Returns both filename= and filename*= for compatibility.
 */
function encodeFilename(
  filename: string,
): { filename: string; filenameExt: string | null } {
  const isAscii = /^[\x20-\x7e]*$/.test(filename);

  if (isAscii) {
    return { filename, filenameExt: null };
  }

  const encoded = Buffer.from(filename, "utf8")
    .toString("hex")
    .replace(/(.{2})/g, "%$1")
    .toUpperCase();

  const asciiFilename = filename
    .split("")
    .map((c) => (/[\x20-\x7e]/.test(c) ? c : "_"))
    .join("");

  return {
    filename: asciiFilename || "attachment",
    filenameExt: `UTF-8''${encoded}`,
  };
}

test("encodeFilename: ASCII filenames", () => {
  const result = encodeFilename("report.pdf");
  assert.strictEqual(result.filename, "report.pdf");
  assert.strictEqual(result.filenameExt, null);
});

test("encodeFilename: Korean filenames", () => {
  const result = encodeFilename("처방전.pdf");
  assert.strictEqual(result.filename, "___.pdf"); // 3 Korean chars + dot + pdf
  assert.ok(result.filenameExt);
  assert.ok(result.filenameExt.startsWith("UTF-8''"));
  // Verify it decodes back correctly
  const percentEncoded = result.filenameExt.substring(7); // Remove "UTF-8''"
  const hex = percentEncoded.replace(/%/g, ""); // Remove percent signs
  const decoded = Buffer.from(hex, "hex").toString("utf8");
  assert.strictEqual(decoded, "처방전.pdf");
});

test("encodeFilename: Mixed ASCII and Korean", () => {
  const result = encodeFilename("report_처방전.pdf");
  assert.strictEqual(result.filename, "report____.pdf"); // "report_" (ASCII) + 3 Korean chars + ".pdf"
  assert.ok(result.filenameExt);
  const percentEncoded = result.filenameExt.substring(7);
  const hex = percentEncoded.replace(/%/g, "");
  const decoded = Buffer.from(hex, "hex").toString("utf8");
  assert.strictEqual(decoded, "report_처방전.pdf");
});

test("encodeFilename: Special characters", () => {
  const result = encodeFilename("file (1) [2].pdf");
  assert.strictEqual(result.filename, "file (1) [2].pdf");
  assert.strictEqual(result.filenameExt, null);
});
