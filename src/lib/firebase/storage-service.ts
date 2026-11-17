"use client";

// Contact 브리프 파일 업로드(브라우저 → Storage contact-briefs/{contactId}/{index}). 2026-11-17
// - submitInquiry가 briefFiles 선언과 함께 문서를 만든 뒤 호출한다. storage.rules가 선언의 크기·형식과 대조하고,
//   새로 만들기만 허용한다(30분 이내). Functions가 Drive로 옮기고 이 임시 파일을 지운다
// - 파일별 결과를 돌려준다(일부 실패해도 나머지는 계속). Mock 모드에서는 올리지 않고 성공으로 처리
import { ref, uploadBytesResumable } from "firebase/storage";
import { getFirebaseStorage, useMockAuth as isMockAuth } from "@/lib/firebase/client";
import type { BriefFileMeta } from "@/lib/firebase/firestore-service";

export type BriefUploadResult = "uploaded" | "failed";

/** Storage path for briefFiles[index] — must match storage.rules. */
export function briefStoragePath(contactId: string, index: number): string {
  return `contact-briefs/${contactId}/${index}`;
}

/**
 * Uploads `files[i]` with the content type declared in `metas[i]`, all in parallel.
 * `onProgress(i, fraction)` reports 0–1 per file.
 */
export async function uploadBriefFiles(
  contactId: string,
  files: readonly Blob[],
  metas: readonly BriefFileMeta[],
  onProgress?: (index: number, fraction: number) => void,
): Promise<BriefUploadResult[]> {
  if (isMockAuth()) {
    console.info("[mock] contact brief upload — not uploaded", { contactId, metas });
    files.forEach((_, i) => onProgress?.(i, 1));
    return files.map(() => "uploaded");
  }

  const storage = getFirebaseStorage();
  const settled = await Promise.allSettled(
    files.map((file, i) => {
      const task = uploadBytesResumable(ref(storage, briefStoragePath(contactId, i)), file, {
        contentType: metas[i].contentType,
      });
      task.on("state_changed", (snap) => {
        if (snap.totalBytes > 0) onProgress?.(i, snap.bytesTransferred / snap.totalBytes);
      });
      return task;
    }),
  );
  return settled.map((result, i) => {
    if (result.status === "fulfilled") return "uploaded";
    console.error(`contact brief upload failed (file ${i})`, result.reason);
    return "failed";
  });
}
