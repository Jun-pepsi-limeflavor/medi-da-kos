/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Google Drive REST 최소 클라이언트 (공유 드라이브 전용, googleapis 패키지 없이 fetch).
 *
 * 인증: 함수 실행 계정이 drive-archiver@<project> 를 대리(Impersonated)해 drive 범위 토큰을 받는다.
 * 키 파일 없음 — 실행 계정에 roles/iam.serviceAccountTokenCreator 가 drive-archiver 에 부여돼 있어야 한다.
 * drive-archiver 는 공유 드라이브의 콘텐츠 관리자라 영구 삭제는 못 한다(이 클라이언트도 삭제 기능이 없다).
 */
const { GoogleAuth, Impersonated } = require("google-auth-library");

const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const FILE_FIELDS = "id,name,webViewLink,createdTime";

class DriveError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "DriveError";
    this.status = status;
  }

  /** Rate limit, server errors and network failures are worth retrying. */
  get retryable() {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

/** Drive query string literal: escape backslash and single quote. */
function q(value) {
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

/**
 * @param {object} opts
 * @param {string} [opts.targetPrincipal] drive-archiver service account email (ignored when getToken is given)
 * @param {() => Promise<string>} [opts.getToken] test hook
 * @param {typeof fetch} [opts.fetchImpl] test hook
 */
function createDriveClient({ targetPrincipal, getToken, fetchImpl = fetch } = {}) {
  let impersonated;

  async function token() {
    if (getToken) return getToken();
    if (!impersonated) {
      const sourceClient = await new GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      }).getClient();
      impersonated = new Impersonated({ sourceClient, targetPrincipal, targetScopes: [DRIVE_SCOPE], lifetime: 3600 });
    }
    const { token: accessToken } = await impersonated.getAccessToken();
    if (!accessToken) throw new DriveError(0, `Drive token for ${targetPrincipal} is empty`);
    return accessToken;
  }

  /** Authorized fetch; non-2xx and network errors become DriveError. */
  async function request(url, init = {}) {
    let res;
    try {
      res = await fetchImpl(url, {
        ...init,
        headers: { ...init.headers, authorization: `Bearer ${await token()}` },
      });
    } catch (error) {
      if (error instanceof DriveError) throw error;
      throw new DriveError(0, `Drive request failed: ${error.message}`);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new DriveError(res.status, `Drive ${init.method || "GET"} ${res.status}: ${text.slice(0, 300)}`);
    }
    return res;
  }

  async function call(url, init) {
    return (await request(url, init)).json();
  }

  /** Children of `parentId` matching `filter`, oldest first. */
  async function listChildren(parentId, filter) {
    const params = new URLSearchParams({
      q: `${q(parentId)} in parents and trashed = false and ${filter}`,
      fields: `files(${FILE_FIELDS})`,
      orderBy: "createdTime",
      pageSize: "10",
      corpora: "allDrives",
      includeItemsFromAllDrives: "true",
      supportsAllDrives: "true",
    });
    const json = await call(`${DRIVE_API}?${params}`);
    return json.files || [];
  }

  async function createFolder(parentId, name, extra = {}) {
    return call(`${DRIVE_API}?supportsAllDrives=true&fields=${FILE_FIELDS}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId], ...extra }),
    });
  }

  /**
   * Folder `name` under `parentId`, created if missing. If two calls race and both create one,
   * later calls converge on the oldest (orderBy createdTime).
   */
  async function ensureFolder(parentId, name) {
    const [found] = await listChildren(parentId, `mimeType = ${q(FOLDER_MIME)} and name = ${q(name)}`);
    return found || createFolder(parentId, name);
  }

  /** First child of `parentId` whose appProperties[key] == value (used to make retries idempotent). */
  async function findByAppProperty(parentId, key, value) {
    const [found] = await listChildren(parentId, `appProperties has { key=${q(key)} and value=${q(value)} }`);
    return found || null;
  }

  /**
   * Resumable upload (Drive recommends multipart only up to 5 MB; briefs go up to 50 MB):
   * open a session with the metadata, then send all bytes in one PUT to the session URL.
   */
  async function uploadFile({ parentId, name, mimeType, data, appProperties, description }) {
    const session = await request(`${UPLOAD_API}?uploadType=resumable&supportsAllDrives=true&fields=${FILE_FIELDS}`, {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=UTF-8",
        "x-upload-content-type": mimeType,
        "x-upload-content-length": String(data.length),
      },
      body: JSON.stringify({ name, mimeType, parents: [parentId], appProperties, description }),
    });
    const location = session.headers.get("location");
    if (!location) throw new DriveError(0, "Drive resumable upload returned no session URL");
    return call(location, { method: "PUT", headers: { "content-type": mimeType }, body: data });
  }

  return { createFolder, ensureFolder, findByAppProperty, uploadFile };
}

module.exports = { createDriveClient, DriveError, FOLDER_MIME };
