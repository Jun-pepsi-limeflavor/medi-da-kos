"use client";

// 링크 클릭·뒤로가기 시점을 기록하는 전역 설치 컴포넌트(화면 없음). 루트 레이아웃에 한 번 둔다.
// - 받는 페이지(FAQ)가 일반 링크 진입 / 딥링크 진입 / 방문 기록 이동을 구분하는 데 사용(lib/utils/navigation-intent)
import { useEffect } from "react";
import { installNavigationIntent } from "@/lib/utils/navigation-intent";

export function NavigationIntent() {
  useEffect(() => installNavigationIntent(), []);
  return null;
}
