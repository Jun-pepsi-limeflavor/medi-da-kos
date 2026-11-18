// 개발 전용: SNS Post Modal 테스트 미디어(tests/fixtures/social-media)를 제공한다. 개발 서버가 아니면 항상 404.
// - 파일 이름은 영문 소문자·숫자·하이픈 + .jpg/.mp4만 허용(경로 이동 불가), 영상은 Range 요청 지원(재생 위치 이동)
// - 'TEST' 표시가 들어간 개발용 미디어이며 실제 Medidakos 게시물이 아니다(lib/social/test-posts.ts)
import { readFile } from "node:fs/promises";
import path from "node:path";

const DIR = path.join(process.cwd(), "tests", "fixtures", "social-media");
const TYPES: Record<string, string> = { jpg: "image/jpeg", mp4: "video/mp4" };

export async function GET(request: Request, { params }: { params: Promise<{ file: string }> }) {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });
  const { file } = await params;
  const match = /^[a-z0-9-]+\.(jpg|mp4)$/.exec(file);
  if (!match) return new Response("Not found", { status: 404 });

  let data: Buffer;
  try {
    data = await readFile(path.join(DIR, file));
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const type = TYPES[match[1]];
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), data.length - 1) : data.length - 1;
    return new Response(new Uint8Array(data.subarray(start, end + 1)), {
      status: 206,
      headers: { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${data.length}`, "Accept-Ranges": "bytes", "Content-Length": String(end - start + 1) },
    });
  }
  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": type, "Content-Length": String(data.length), "Accept-Ranges": "bytes", "Cache-Control": "no-store" },
  });
}
