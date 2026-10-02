/**
 * Channel Talk Open API 클라이언트 (웹 접수 연동 전용).
 *
 * - 날짜 버전 API(`/open/...` + `Channel-Version` 헤더)를 쓴다. functions-ingest의 v5 클라이언트와 별개다.
 * - 4xx(429 제외)는 요청이 거부된 것이 확실한 실패, 429·5xx·시간 초과·네트워크 오류는 결과가 애매한 실패다.
 *   애매한 실패 뒤에는 상담·리드가 이미 만들어졌을 수 있다. 확인할 API가 없어 호출하는 쪽이
 *   다시 만들고 possibleOrphanChat·possibleOrphanLead로 표시한다.
 * - 오류 메시지에 응답 본문·인증값·고객 정보를 넣지 않는다.
 */

const BASE_URL = "https://api.channel.io";
const DEFAULT_TIMEOUT_MS = 10 * 1000;
const PAGE_LIMIT = 100;
const MAX_PAGES = 50;
const NOTE_OPTIONS = ["private", "silentToUser"];

class ChannelTalkApiError extends Error {
  constructor(message, { status = null, code = "request_failed", ambiguous = false, retryAfterSeconds = null } = {}) {
    super(message);
    this.name = "ChannelTalkApiError";
    this.status = status;
    this.code = code;
    this.ambiguous = ambiguous;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function buildQuery(query) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

function createChannelTalkApi({
  accessKey,
  accessSecret,
  version,
  baseUrl = BASE_URL,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  if (!accessKey || !accessSecret) throw new TypeError("Channel Talk access key and secret are required");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(version || ""))) throw new TypeError("Channel-Version must be YYYY-MM-DD");
  if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");

  async function request(method, path, { query, json, form } = {}) {
    const headers = {
      "x-access-key": accessKey,
      "x-access-secret": accessSecret,
      "Channel-Version": version,
      Accept: "application/json",
    };
    let body;
    if (json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(json);
    } else if (form !== undefined) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      body = new URLSearchParams(form).toString();
    }

    const label = `${method} ${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(`${baseUrl}${path}${buildQuery(query)}`, { method, headers, body, signal: controller.signal });
    } catch (error) {
      const code = error && error.name === "AbortError" ? "timeout" : "network_error";
      throw new ChannelTalkApiError(`${label} ${code}`, { code, ambiguous: true });
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 204) return null;
    if (!response.ok) {
      const status = response.status;
      const retryAfter = Number(response.headers && response.headers.get && response.headers.get("retry-after"));
      if (status === 429) {
        throw new ChannelTalkApiError(`${label} 429`, {
          status, code: "rate_limited", ambiguous: true, retryAfterSeconds: Number.isFinite(retryAfter) ? retryAfter : null,
        });
      }
      if (status >= 500) throw new ChannelTalkApiError(`${label} ${status}`, { status, code: "server_error", ambiguous: true });
      throw new ChannelTalkApiError(`${label} ${status}`, { status, code: status === 404 ? "not_found" : "rejected" });
    }
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      throw new ChannelTalkApiError(`${label} invalid_json`, { status: response.status, code: "invalid_json", ambiguous: true });
    }
  }

  async function orNull(promise) {
    try {
      return await promise;
    } catch (error) {
      if (error instanceof ChannelTalkApiError && error.code === "not_found") return null;
      throw error;
    }
  }

  function pick(data, key) {
    return data && typeof data === "object" && data[key] && typeof data[key] === "object" ? data[key] : null;
  }

  const enc = encodeURIComponent;

  return {
    async getUser(userId) {
      return pick(await orNull(request("GET", `/open/users/${enc(userId)}`)), "user");
    },
    async getUserByMemberId(memberId) {
      return pick(await orNull(request("GET", `/open/users/@${enc(memberId)}`)), "user");
    },
    /** 회원을 memberId로 만들거나 갱신한다. body: { profile?, profileOnce?, tags? } */
    async upsertMember(memberId, body) {
      return pick(await request("PUT", `/open/users/@${enc(memberId)}`, { json: body || {} }), "user");
    },
    /** memberId 없는 리드를 만든다. 명세상 profile은 JSON 문자열을 form으로 보낸다. */
    async createLead(profile) {
      return pick(await request("POST", "/open/users", { form: { profile: JSON.stringify(profile || {}) } }), "user");
    },
    /** body: { profile?, profileOnce?, tags? }. tags는 전체 교체다. */
    async patchUser(userId, body) {
      return pick(await request("PATCH", `/open/users/${enc(userId)}`, { json: body }), "user");
    },
    async createUserChat(userId) {
      return pick(await request("POST", `/open/users/${enc(userId)}/user-chats`), "userChat");
    },
    async getUserChat(userChatId) {
      return pick(await orNull(request("GET", `/open/user-chats/${enc(userChatId)}`)), "userChat");
    },
    async listAllMessages(userChatId, { maxPages = MAX_PAGES } = {}) {
      const all = [];
      let cursor = null;
      for (let page = 0; page < maxPages; page += 1) {
        const data = await request("GET", `/open/user-chats/${enc(userChatId)}/messages`, {
          query: { limit: PAGE_LIMIT, sortOrder: "asc", cursor },
        });
        all.push(...(Array.isArray(data && data.messages) ? data.messages : []));
        const next = (data && data.nextCursor) || null;
        if (!(data && data.hasNext) || !next || next === cursor) return all;
        cursor = next;
      }
      throw new ChannelTalkApiError("GET messages page_limit", { code: "page_limit", ambiguous: true });
    },
    /** 고객에게 보이지 않는 내부대화. 고객 알림도 막는다. */
    async sendPrivateNote(userChatId, plainText, botName) {
      return pick(
        await request("POST", `/open/user-chats/${enc(userChatId)}/messages`, {
          query: { botName },
          json: { plainText, options: NOTE_OPTIONS },
        }),
        "message",
      );
    },
    async openUserChat(userChatId, botName) {
      return pick(await request("PUT", `/open/user-chats/${enc(userChatId)}/open`, { query: { botName } }), "userChat");
    },
  };
}

module.exports = {
  ChannelTalkApiError,
  NOTE_OPTIONS,
  createChannelTalkApi,
};
