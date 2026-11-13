// Firestore users/{uid} 문서에 쓸 값 만들기(화면·Firebase와 분리된 순수 함수 — 테스트 대상).
// - 새 문서: uid·email·createdAt + 프로필 항목 + isTest (기존과 같은 모양, firestore.rules의 create 허용 키 안)
// - 기존 문서(예: 이메일로 가입한 회원이 나중에 Google로 로그인 → 같은 uid): 빈 문자열 항목은 쓰지 않아
//   저장돼 있던 전화번호·국가·회사명이 지워지지 않게 한다(2026-11-12). 값이 있는 항목과 provider·isTest만 갱신
import type { UserProfile } from "@/lib/types";
import { stripUndefined } from "@/lib/firebase/sanitize";

export function userProfileWrite(profile: UserProfile, exists: boolean, isTest: boolean): Record<string, unknown> {
  const { uid, email, displayName, phone, country, companyName, provider, createdAt } = profile;
  const mutable = { displayName, phone, country, companyName, provider, isTest };
  if (!exists) return stripUndefined({ uid, email, createdAt, ...mutable });
  return stripUndefined(Object.fromEntries(Object.entries(mutable).filter(([, value]) => value !== "")));
}
