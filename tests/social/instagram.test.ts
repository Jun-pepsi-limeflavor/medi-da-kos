// Instagram 피드 변환·조회 단위 테스트(실제 Meta API 호출 없음 — fetch를 가짜로 바꾼다).
import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";

register("../esm-alias-loader.mjs", import.meta.url);
const { toSocialPost, toSocialPosts, getInstagramPosts } = await import("../../src/lib/social/instagram.ts");
const { splitCaptionHashtags, socialDisplayName, socialProfileHref } = await import("../../src/lib/social/types.ts");

test("account: profile link from a valid username only; display name drops the leading @", () => {
  const post = toSocialPost({ id: "p", media_type: "IMAGE", media_url: "https://cdn.example/p.jpg", permalink: "https://www.instagram.com/p/x/", username: "medidakos" });
  assert.equal(post?.account.handle, "@medidakos");
  assert.equal(post?.account.profileUrl, "https://www.instagram.com/medidakos/");
  assert.equal(socialDisplayName("@medidakos"), "medidakos");
  assert.equal(socialDisplayName("medidakos"), "medidakos");

  const odd = toSocialPost({ id: "q", media_type: "IMAGE", media_url: "https://cdn.example/q.jpg", permalink: "https://www.instagram.com/p/y/", username: "bad/../name" });
  assert.equal(odd?.account.profileUrl, undefined);
  const none = toSocialPost({ id: "r", media_type: "IMAGE", media_url: "https://cdn.example/r.jpg", permalink: "https://www.instagram.com/p/z/" });
  assert.equal(none?.account.profileUrl, undefined);

  // No guessed links: missing, malformed or non-https profile URLs render as plain content.
  assert.equal(socialProfileHref({}), undefined);
  assert.equal(socialProfileHref({ profileUrl: "not a url" }), undefined);
  assert.equal(socialProfileHref({ profileUrl: "javascript:alert(1)" }), undefined);
  assert.equal(socialProfileHref({ profileUrl: "http://www.tiktok.com/@medidakos" }), undefined);
  assert.equal(socialProfileHref({ profileUrl: "https://www.tiktok.com/@medidakos" }), "https://www.tiktok.com/@medidakos");
});

test("caption hashtags are split for display only; joining the parts gives the original caption", () => {
  const caption =
    "Selling abroad? 🌍\n\nWe help #brands launch.\n\n#koreanmanufacturing #cosmeticmanufacturing #privatelabel #OEM #ODM #skincarebrand #beautybrand #madeinkorea #kbeautymanufacturer #medidakos";
  const parts = splitCaptionHashtags(caption);
  assert.equal(parts.map((p) => p.text).join(""), caption);
  assert.deepEqual(
    parts.filter((p) => p.hashtag).map((p) => p.text),
    ["#brands", "#koreanmanufacturing", "#cosmeticmanufacturing", "#privatelabel", "#OEM", "#ODM", "#skincarebrand", "#beautybrand", "#madeinkorea", "#kbeautymanufacturer", "#medidakos"],
  );
  assert.ok(parts.find((p) => p.text.startsWith("Selling abroad?") && !p.hashtag));
  assert.deepEqual(splitCaptionHashtags("No tags here"), [{ text: "No tags here", hashtag: false }]);
  assert.deepEqual(splitCaptionHashtags(""), []);
  assert.deepEqual(splitCaptionHashtags("# alone and C#"), [{ text: "# alone and C#", hashtag: false }]);
});

const base = {
  permalink: "https://www.instagram.com/p/abc/",
  timestamp: "2026-10-22T09:37:05+0000",
  username: "medidakos",
};

test("image post: one image, caption, date, link, card label", () => {
  const post = toSocialPost({
    ...base,
    id: "1",
    media_type: "IMAGE",
    media_url: "https://cdn.example/img.jpg",
    caption: "\n  First line  \nSecond line #tag",
  });
  assert.ok(post);
  assert.equal(post.platform, "instagram");
  assert.equal(post.account.handle, "@medidakos");
  assert.equal(post.caption, "\n  First line  \nSecond line #tag");
  assert.equal(post.cardLabel, "First line");
  assert.equal(post.publishedAt, "2026-10-22T09:37:05.000Z");
  assert.equal(post.permalink, base.permalink);
  assert.equal(post.thumbnailUrl, "https://cdn.example/img.jpg");
  assert.deepEqual(post.media.map((m) => m.type), ["image"]);
  assert.equal(post.isTestContent, undefined);
});

test("reel: video with thumbnail as poster and card cover, 9:16", () => {
  const post = toSocialPost({
    ...base,
    id: "2",
    media_type: "VIDEO",
    media_url: "https://cdn.example/reel.mp4",
    thumbnail_url: "https://cdn.example/reel.jpg",
  });
  assert.ok(post);
  const [video] = post.media;
  assert.equal(video.type, "video");
  assert.equal(video.src, "https://cdn.example/reel.mp4");
  assert.equal(video.type === "video" && video.poster, "https://cdn.example/reel.jpg");
  assert.equal(video.width / video.height, 1080 / 1920);
  assert.equal(post.thumbnailUrl, "https://cdn.example/reel.jpg");
});

test("video without media_url (licensed audio) falls back to its thumbnail image", () => {
  const post = toSocialPost({ ...base, id: "3", media_type: "VIDEO", thumbnail_url: "https://cdn.example/t.jpg" });
  assert.ok(post);
  assert.deepEqual(post.media.map((m) => [m.type, m.src]), [["image", "https://cdn.example/t.jpg"]]);
});

test("carousel keeps child order, skips unusable children, first child is the cover", () => {
  const post = toSocialPost({
    ...base,
    id: "4",
    media_type: "CAROUSEL_ALBUM",
    media_url: "https://cdn.example/cover.jpg",
    children: {
      data: [
        { id: "c1", media_type: "IMAGE", media_url: "https://cdn.example/1.jpg" },
        { id: "c2", media_type: "IMAGE" },
        { id: "c3", media_type: "VIDEO", media_url: "https://cdn.example/3.mp4", thumbnail_url: "https://cdn.example/3.jpg" },
        { id: "c4", media_type: "IMAGE", media_url: "https://cdn.example/4.jpg" },
      ],
    },
  });
  assert.ok(post);
  assert.deepEqual(post.media.map((m) => m.src), ["https://cdn.example/1.jpg", "https://cdn.example/3.mp4", "https://cdn.example/4.jpg"]);
  assert.equal(post.thumbnailUrl, "https://cdn.example/1.jpg");
  assert.equal(post.media[0].alt, "Instagram post image 1 of 4");
});

test("posts without media or a public link are skipped; no caption → empty caption, no card label", () => {
  assert.equal(toSocialPost({ ...base, id: "5", media_type: "IMAGE" }), null);
  assert.equal(toSocialPost({ id: "6", media_type: "IMAGE", media_url: "https://cdn.example/x.jpg" }), null);
  const post = toSocialPost({ ...base, id: "7", media_type: "IMAGE", media_url: "https://cdn.example/x.jpg" });
  assert.ok(post);
  assert.equal(post.caption, "");
  assert.equal(post.cardLabel, undefined);
});

test("unreadable timestamp → empty publishedAt (the modal then hides the date)", () => {
  const post = toSocialPost({ ...base, id: "8", timestamp: "not a date", media_type: "IMAGE", media_url: "https://cdn.example/x.jpg" });
  assert.equal(post?.publishedAt, "");
});

test("feed response keeps API order and applies the limit; malformed responses give []", () => {
  const data = Array.from({ length: 15 }, (_, i) => ({ ...base, id: String(i), media_type: "IMAGE", media_url: `https://cdn.example/${i}.jpg` }));
  const posts = toSocialPosts({ data }, 12);
  assert.equal(posts.length, 12);
  assert.deepEqual(posts.slice(0, 3).map((p) => p.id), ["0", "1", "2"]);
  assert.deepEqual(toSocialPosts(null), []);
  assert.deepEqual(toSocialPosts({ error: { code: 190 } }), []);
});

async function withEnv(env: Record<string, string | undefined>, fetchImpl: typeof fetch, run: () => Promise<void>) {
  const saved = { token: process.env.INSTAGRAM_ACCESS_TOKEN, id: process.env.INSTAGRAM_USER_ID, fetch: globalThis.fetch, error: console.error };
  const logs: string[] = [];
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  globalThis.fetch = fetchImpl;
  console.error = (...args: unknown[]) => void logs.push(args.join(" "));
  try {
    await run();
  } finally {
    if (saved.token === undefined) delete process.env.INSTAGRAM_ACCESS_TOKEN;
    else process.env.INSTAGRAM_ACCESS_TOKEN = saved.token;
    if (saved.id === undefined) delete process.env.INSTAGRAM_USER_ID;
    else process.env.INSTAGRAM_USER_ID = saved.id;
    globalThis.fetch = saved.fetch;
    console.error = saved.error;
  }
  return logs;
}

test("missing token or account ID → [] without calling the API", async () => {
  let called = false;
  const fake = (async () => {
    called = true;
    return new Response("{}");
  }) as typeof fetch;
  await withEnv({ INSTAGRAM_ACCESS_TOKEN: undefined, INSTAGRAM_USER_ID: "123" }, fake, async () => {
    assert.deepEqual(await getInstagramPosts(), []);
  });
  await withEnv({ INSTAGRAM_ACCESS_TOKEN: "secret-token", INSTAGRAM_USER_ID: "" }, fake, async () => {
    assert.deepEqual(await getInstagramPosts(), []);
  });
  assert.equal(called, false);
});

test("request: server-side bearer header, token never in the URL; API/network errors → [] and no token in logs", async () => {
  const seen: { url: string; auth: string | null; revalidate?: number }[] = [];
  const ok = (async (input: string | URL | Request, init?: RequestInit & { next?: { revalidate?: number } }) => {
    seen.push({ url: String(input), auth: new Headers(init?.headers).get("authorization"), revalidate: init?.next?.revalidate });
    if (String(input).includes("fields=profile_picture_url")) return Response.json({ profile_picture_url: "https://cdn.example/avatar.jpg", id: "1" });
    return Response.json({ data: [{ ...base, id: "9", media_type: "IMAGE", media_url: "https://cdn.example/9.jpg" }] });
  }) as typeof fetch;
  await withEnv({ INSTAGRAM_ACCESS_TOKEN: "secret-token", INSTAGRAM_USER_ID: "17841440911075920" }, ok, async () => {
    const posts = await getInstagramPosts();
    assert.deepEqual(posts.map((p) => p.id), ["9"]);
    assert.equal(posts[0].account.avatarUrl, "https://cdn.example/avatar.jpg");
  });
  assert.equal(seen.length, 2);
  const media = seen.find((s) => s.url.includes("/media?"));
  assert.ok(media);
  assert.match(media.url, /^https:\/\/graph\.facebook\.com\/v\d+\.\d+\/17841440911075920\/media\?/);
  assert.match(media.url, /limit=12/);
  for (const s of seen) {
    assert.doesNotMatch(s.url, /secret-token/);
    assert.equal(s.auth, "Bearer secret-token");
    assert.equal(s.revalidate, 900);
  }

  // Profile picture unavailable → posts still shown, gray-circle fallback (no avatarUrl).
  const noProfile = (async (input: string | URL | Request) =>
    String(input).includes("fields=profile_picture_url")
      ? Response.json({ error: { code: 100 } }, { status: 400 })
      : Response.json({ data: [{ ...base, id: "10", media_type: "IMAGE", media_url: "https://cdn.example/10.jpg" }] })) as typeof fetch;
  await withEnv({ INSTAGRAM_ACCESS_TOKEN: "secret-token", INSTAGRAM_USER_ID: "1" }, noProfile, async () => {
    const posts = await getInstagramPosts();
    assert.deepEqual(posts.map((p) => p.id), ["10"]);
    assert.equal(posts[0].account.avatarUrl, undefined);
  });

  const apiError = (async () => Response.json({ error: { code: 190, type: "OAuthException", message: "Invalid token secret-token" } }, { status: 400 })) as typeof fetch;
  const apiLogs = await withEnv({ INSTAGRAM_ACCESS_TOKEN: "secret-token", INSTAGRAM_USER_ID: "1" }, apiError, async () => {
    assert.deepEqual(await getInstagramPosts(), []);
  });
  assert.match(apiLogs.join("\n"), /HTTP 400 code=190/);
  assert.doesNotMatch(apiLogs.join("\n"), /secret-token/);

  const netError = (async () => {
    throw new TypeError("fetch failed");
  }) as typeof fetch;
  const netLogs = await withEnv({ INSTAGRAM_ACCESS_TOKEN: "secret-token", INSTAGRAM_USER_ID: "1" }, netError, async () => {
    assert.deepEqual(await getInstagramPosts(), []);
  });
  assert.doesNotMatch(netLogs.join("\n"), /secret-token/);
});
