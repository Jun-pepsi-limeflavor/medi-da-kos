"use client";
import { useEffect, useState } from "react";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { getChannelTalkDebugState } from "@/lib/channel-talk";
import { getGaClientId } from "@/lib/ga-client-id";

export default function TestPage() {
  const [results, setResults] = useState<Record<string, string>>({});

  const log = (key: string, value: string) =>
    setResults((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    const timer = window.setInterval(() => {
      const state = getChannelTalkDebugState();
      log(
        "ChannelTalk",
        state.lastBootError
          ? `❌ boot error — ${state.lastBootError}`
          : state.bootedMemberId
            ? `✅ member boot — uid ${state.bootedMemberId}`
            : state.bootedAnonymous
              ? "✅ anonymous boot"
              : state.channelIoLoaded
                ? "⏳ SDK loaded, boot pending"
                : "⏳ SDK not loaded yet",
      );

      if (state.lastSyncedBriefStep) {
        const { step, stepLabel, source } = state.lastSyncedBriefStep;
        log(
          "BriefStep",
          `✅ last sync — step ${step} (${stepLabel}) via ${source}`,
        );
      } else if (state.pendingBriefStep) {
        log(
          "BriefStep",
          `⏳ pending — step ${state.pendingBriefStep.step} (${state.pendingBriefStep.stepLabel}), waiting for boot`,
        );
      } else {
        log(
          "BriefStep",
          "⏳ none yet — dwell sync runs on /dashboard after 40s on a step",
        );
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const testChannelTalkHash = async () => {
    try {
      const auth = getFirebaseAuth();
      const uid = auth.currentUser?.uid ?? "test-anonymous-uid";
      const res = await fetch("/api/channel-talk/member-hash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: uid }),
      });
      const data = await res.json();
      log(
        "MemberHash",
        data.memberHash
          ? `✅ API ok for uid ${uid} — hash ${String(data.memberHash).slice(0, 12)}...`
          : `⚠️ hash not returned (secret missing?)`,
      );
    } catch (e: unknown) {
      log(
        "MemberHash",
        `❌ failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  const testGaClientId = async () => {
    const gaId = process.env.NEXT_PUBLIC_GA_ID;
    const clientId = await getGaClientId(gaId);
    log("GA client_id", clientId ? `✅ ${clientId}` : "❌ not available yet");
  };

  // 1. Auth 테스트
  const testAuth = async () => {
    try {
      const cred = await signInWithEmailAndPassword(
        getFirebaseAuth(), "admin@medidakos.com", "Admin1234!"
      );
      log("Auth", `✅ 로그인 성공 — UID: ${cred.user.uid}`);
    } catch (e: any) {
      log("Auth", `❌ 실패: ${e.message}`);
    }
  };

  // 2. Firestore 테스트
  const testFirestore = async () => {
    try {
      const ref = doc(getFirebaseDb(), "test", "ping");
      await setDoc(ref, { message: "hello", ts: new Date() });
      const snap = await getDoc(ref);
      log("Firestore", `✅ 저장/읽기 성공 — ${JSON.stringify(snap.data())}`);
    } catch (e: any) {
      log("Firestore", `❌ 실패: ${e.message}`);
    }
  };

  // 3. 로그아웃
  const testSignOut = async () => {
    await signOut(getFirebaseAuth());
    log("SignOut", "✅ 로그아웃 완료");
  };

  return (
    <div style={{ padding: 40, fontFamily: "monospace" }}>
      <h1>Firebase 연결 테스트</h1>
      <div style={{ display: "flex", gap: 12, marginBottom: 32, flexWrap: "wrap" }}>
        <button onClick={testAuth}>1. Auth 로그인</button>
        <button onClick={testFirestore}>2. Firestore 읽기/쓰기</button>
        <button onClick={testSignOut}>3. 로그아웃</button>
        <button onClick={testGaClientId}>4. GA client_id</button>
        <button onClick={testChannelTalkHash}>5. Channel hash API</button>
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