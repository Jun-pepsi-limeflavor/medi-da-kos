#!/usr/bin/env python3
"""Convert readpst-exported RFC 822 files to the shared message contract."""

import argparse
import email
import hashlib
import html
import json
import re
import subprocess
import sys
from datetime import timezone
from email import policy
from email.header import decode_header, make_header
from email.parser import BytesParser
from email.utils import getaddresses, parsedate_to_datetime
from pathlib import Path


CHANNEL = "outlook_support"
TAG_RE = re.compile(r"<[^>]+>")
MESSAGE_ID_RE = re.compile(r"<[^>]+>")


def decode_value(value):
    if not value:
        return ""
    try:
        return str(make_header(decode_header(value)))
    except (LookupError, UnicodeError, ValueError):
        return str(value)


def address_parts(value):
    addresses = getaddresses([value] if value else [])
    if not addresses:
        return "", ""
    name, address = addresses[0]
    return decode_value(name).strip(), address.strip().lower()


def address_list(value):
    return [
        address.strip().lower()
        for _, address in getaddresses([value] if value else [])
        if address and "@" in address
    ]


def iso_date(value, path):
    if not value:
        raise ValueError(f"{path}: Date header is required")
    try:
        parsed = parsedate_to_datetime(value)
    except (TypeError, ValueError, OverflowError) as error:
        raise ValueError(f"{path}: invalid Date header") from error
    if parsed is None:
        raise ValueError(f"{path}: invalid Date header")
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def part_text(part):
    try:
        value = part.get_content()
        return value if isinstance(value, str) else str(value)
    except (LookupError, UnicodeError, ValueError):
        payload = part.get_payload(decode=True) or b""
        charset = part.get_content_charset() or "utf-8"
        return payload.decode(charset, errors="replace")


def strip_html(value):
    value = re.sub(r"<br\s*/?>", "\n", value, flags=re.IGNORECASE)
    value = re.sub(r"</p\s*>", "\n", value, flags=re.IGNORECASE)
    value = TAG_RE.sub("", value)
    return html.unescape(value)


def rtf_to_text(payload):
    """Convert readpst's RTF-only Outlook body with macOS' native converter."""
    try:
        result = subprocess.run(
            ["textutil", "-convert", "txt", "-stdout", "-format", "rtf", "-stdin"],
            input=payload,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True,
        )
    except (FileNotFoundError, subprocess.CalledProcessError) as error:
        raise ValueError(
            "RTF-only Outlook message requires macOS textutil to preserve its body"
        ) from error
    return result.stdout.decode("utf-8", errors="replace")


def body_and_attachments(message, message_key):
    plain = []
    markup = []
    rtf_bodies = []
    attachments = []
    for part in message.walk():
        if part.is_multipart():
            continue
        disposition = part.get_content_disposition()
        filename = decode_value(part.get_filename())
        payload = part.get_payload(decode=True) or b""
        # readpst writes Outlook RTF-only message bodies as rtf-body.rtf.
        # Keep that synthetic attachment aside until we know no normal text
        # body exists; other named RTF files remain ordinary attachments.
        if (
            part.get_content_type() == "application/rtf"
            and disposition == "attachment"
            and filename.lower() == "rtf-body.rtf"
        ):
            rtf_bodies.append(payload)
            continue
        if disposition == "attachment" or filename:
            attachments.append({
                "filename": filename or f"attachment-{len(attachments) + 1}",
                "mimeType": part.get_content_type() or "application/octet-stream",
                "size": len(payload),
                "attachmentId": f"pst:{message_key}:attachment:{len(attachments)}",
            })
            continue
        if part.get_content_type() == "text/plain":
            plain.append(part_text(part))
        elif part.get_content_type() == "text/html":
            markup.append(part_text(part))

    body = "\n\n".join(value for value in plain if value).strip()
    if not body:
        body = "\n\n".join(strip_html(value) for value in markup if value).strip()
    if not body and rtf_bodies:
        body = "\n\n".join(rtf_to_text(value) for value in rtf_bodies if value).strip()
    return body.replace("\r\n", "\n").replace("\r", "\n"), attachments


def thread_id(message, message_key):
    thread_index = re.sub(r"\s+", "", decode_value(message.get("Thread-Index", "")))
    if thread_index:
        # Outlook's first 22 base64 characters identify the conversation root.
        root = thread_index[:22]
        return f"pst-thread-index:{hashlib.sha256(root.encode()).hexdigest()[:40]}"

    references = MESSAGE_ID_RE.findall(decode_value(message.get("References", "")))
    if references:
        return f"pst-reference:{hashlib.sha256(references[0].encode()).hexdigest()[:40]}"

    return f"pst-message:{message_key}"


def parse_eml(path, mailbox, side):
    raw = path.read_bytes()
    message = BytesParser(policy=policy.default).parsebytes(raw)
    message_id = decode_value(message.get("Message-ID", "")).strip()
    message_key = hashlib.sha256(raw).hexdigest()
    if message_id:
        message_key = hashlib.sha256(message_id.encode()).hexdigest()

    from_name, sender = address_parts(decode_value(message.get("From", "")))
    body_text, attachments = body_and_attachments(message, message_key)
    source_account = mailbox.strip().lower()
    return {
        "docId": f"{CHANNEL}:pst:{message_key}",
        "channel": CHANNEL,
        "side": side,
        "sideSource": "account_rule",
        "sourceAccount": source_account,
        "externalId": f"pst:{message_key}",
        "providerThreadId": thread_id(message, message_key),
        "threadKey": f"{CHANNEL}:{source_account}:{thread_id(message, message_key)}",
        "historyId": message_id or f"pst:{message_key}",
        "direction": "out" if sender == source_account else "in",
        "from": sender,
        "fromName": from_name,
        "to": address_list(decode_value(message.get("To", ""))),
        "subject": decode_value(message.get("Subject", "")).strip(),
        "bodyText": body_text,
        "attachments": attachments,
        "sentAt": iso_date(message.get("Date"), path),
        "messageId": message_id,
        "inReplyTo": decode_value(message.get("In-Reply-To", "")).strip(),
        "references": decode_value(message.get("References", "")).strip(),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("export_dir", type=Path)
    parser.add_argument("--mailbox", required=True)
    parser.add_argument("--side", choices=("brand", "factory", "unknown"), default="unknown")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    if not args.mailbox.strip() or "@" not in args.mailbox:
        raise ValueError("--mailbox must be an email address")
    files = sorted(
        path for path in args.export_dir.rglob("*")
        if path.is_file() and path.suffix.lower() == ".eml"
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as output:
        for path in files:
            message = parse_eml(path, args.mailbox, args.side)
            output.write(json.dumps(message, ensure_ascii=False, separators=(",", ":")))
            output.write("\n")
    print(f"parsed {len(files)} messages", file=sys.stderr)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, email.errors.MessageParseError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
