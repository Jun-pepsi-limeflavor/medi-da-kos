import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

let app: App | undefined;

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!raw?.trim()) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 is not set");
  }
  return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
}

export function getAdminApp(): App {
  if (!app) {
    app = getApps()[0] ?? initializeApp({ credential: cert(getServiceAccount()) });
  }
  return app;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}
