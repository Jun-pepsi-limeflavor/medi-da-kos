"use client";
import { useEffect, useState } from "react";
import { auth, db, storage } from "@/lib/firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

export default function TestPage() {
  const [results, setResults] = useState<Record<string, string>>({});

  const log = (key: string, value: string) =>
    setResults((prev) => ({ ...prev, [key]: value }));

  // 1. Auth 테스트
  const testAuth = async () => {
    try {
      const cred = await signInWithEmailAndPassword(
        auth, "admin@medidakos.com", "Admin1234!"
      );
      log("Auth", `✅ 로그인 성공 — UID: ${cred.user.uid}`);
    } catch (e: any) {
      log("Auth", `❌ 실패: ${e.message}`);
    }
  };

  // 2. Firestore 테스트
  const testFirestore = async () => {
    try {
      const ref = doc(db, "test", "ping");
      await setDoc(ref, { message: "hello", ts: new Date() });
      const snap = await getDoc(ref);
      log("Firestore", `✅ 저장/읽기 성공 — ${JSON.stringify(snap.data())}`);
    } catch (e: any) {
      log("Firestore", `❌ 실패: ${e.message}`);
    }
  };

  // 3. 로그아웃
  const testSignOut = async () => {
    await signOut(auth);
    log("SignOut", "✅ 로그아웃 완료");
  };

  return (
    <div style={{ padding: 40, fontFamily: "monospace" }}>
      <h1>Firebase 연결 테스트</h1>
      <div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
        <button onClick={testAuth}>1. Auth 로그인</button>
        <button onClick={testFirestore}>2. Firestore 읽기/쓰기</button>
        <button onClick={testSignOut}>3. 로그아웃</button>
      </div>
      <ul>
        {Object.entries(results).map(([k, v]) => (
          <li key={k} style={{ marginBottom: 8 }}>
            <strong>{k}:</strong> {v}
          </li>
        ))}
      </ul>
    </div>
  );
}