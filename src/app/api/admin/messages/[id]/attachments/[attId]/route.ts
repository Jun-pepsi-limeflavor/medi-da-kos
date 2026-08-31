import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { getMessage } from "@/lib/repo/messages";
import { getGmailToken } from "@/lib/gmail-auth";
import { withAdmin } from "@/lib/with-admin";

export const runtime = "nodejs";

/**
 * RFC 5987/6266 filename*= encoding for non-ASCII filenames.
 * Returns both filename= and filename*= for compatibility.
 */
function encodeFilename(
  filename: string,
): { filename: string; filenameExt: string | null } {
  // filename= value must be ASCII-safe for maximum compatibility
  // For non-ASCII, add filename*= with RFC 5987 encoding
  const isAscii = /^[\x20-\x7e]*$/.test(filename);

  if (isAscii) {
    return { filename, filenameExt: null };
  }

  // RFC 5987: charset'lang'percent-encoded-string
  // We don't include lang, so it's just charset''percent-encoded
  const encoded = Buffer.from(filename, "utf8")
    .toString("hex")
    .replace(/(.{2})/g, "%$1")
    .toUpperCase();

  // For filename=, use a sanitized ASCII version (remove non-ASCII chars)
  const asciiFilename = filename
    .split("")
    .map((c) => (/[\x20-\x7e]/.test(c) ? c : "_"))
    .join("");

  return {
    filename: asciiFilename || "attachment",
    filenameExt: `UTF-8''${encoded}`,
  };
}

export const GET = withAdmin(async (req: NextRequest) => {
  // Extract params from URL path
  const match = req.nextUrl.pathname.match(
    /^\/api\/admin\/messages\/([^/]+)\/attachments\/([^/]+)$/,
  );
  if (!match) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }

  const rawId = match[1];
  const rawAttId = match[2];
  const id = decodeURIComponent(rawId);
  const attId = decodeURIComponent(rawAttId);

  // Look up message by both decoded id and rawId
  let message = await getMessage(id);
  if (!message && rawId !== id) {
    message = await getMessage(rawId);
  }
  if (!message) {
    return NextResponse.json(
      { error: "message not found" },
      { status: 404 },
    );
  }

  // Find attachment metadata by exact ID or decoded/raw match
  const attachment = message.attachments.find(
    (a) => a.attachmentId === attId || a.attachmentId === rawAttId || a.attachmentId === match[2],
  );
  if (!attachment) {
    return NextResponse.json(
      { error: "attachment not found" },
      { status: 404 },
    );
  }

  // Fetch attachment from Gmail using exact stored attachmentId
  const token = await getGmailToken(message.sourceAccount);
  const gmailRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.externalId}/attachments/${encodeURIComponent(attachment.attachmentId)}`,
    {
      headers: { authorization: `Bearer ${token}` },
    },
  );

  if (!gmailRes.ok) {
    return NextResponse.json(
      { error: "failed to fetch attachment from gmail" },
      { status: gmailRes.status },
    );
  }

  const { data: base64urlData } = (await gmailRes.json()) as {
    data?: string;
  };
  if (!base64urlData) {
    return NextResponse.json(
      { error: "no attachment data in gmail response" },
      { status: 500 },
    );
  }

  // Decode base64url to bytes
  const bytes = Buffer.from(base64urlData, "base64url");

  // Set Content-Disposition header with inline preview support
  const isDownload = req.nextUrl.searchParams.get("download") === "1";
  const dispositionType = isDownload ? "attachment" : "inline";
  const { filename, filenameExt } = encodeFilename(attachment.filename);
  let contentDisposition = `${dispositionType}; filename="${filename}"`;
  if (filenameExt) {
    contentDisposition += `; filename*=${filenameExt}`;
  }

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "content-type": attachment.mimeType || "application/octet-stream",
      "content-length": String(bytes.length),
      "content-disposition": contentDisposition,
      "cache-control": "public, max-age=86400, immutable",
    },
  });
});
