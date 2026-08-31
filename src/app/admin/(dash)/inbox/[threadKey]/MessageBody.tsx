"use client";

import MessageBodyClean from "../MessageBodyClean";
import type { Attachment } from "@/lib/schemas/message";

interface MessageBodyProps {
  text: string;
  attachments?: Attachment[];
  messageId?: string;
  isGmail?: boolean;
  className?: string;
}

export default function MessageBody({
  text,
  attachments = [],
  messageId,
  isGmail = false,
  className = "",
}: MessageBodyProps) {
  return (
    <MessageBodyClean
      bodyText={text}
      attachments={attachments}
      messageId={messageId}
      isGmail={isGmail}
      className={className}
    />
  );
}
