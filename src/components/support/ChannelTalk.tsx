"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getFirebaseAuth, useMockAuth as isMockAuth } from "@/lib/firebase";
import { getGaClientId } from "@/lib/ga-client-id";
import {
  bootChannelTalkAsAnonymous,
  bootChannelTalkAsMember,
  syncChannelTalkRoute,
} from "@/lib/channel-talk";

/** member-hash 요청용 Firebase ID 토큰. 가짜 로그인 모드이거나 얻지 못하면 null(해시 없이 boot). */
async function currentIdToken(): Promise<string | null> {
  if (isMockAuth()) return null;
  try {
    return (await getFirebaseAuth().currentUser?.getIdToken()) ?? null;
  } catch {
    return null;
  }
}

type ChannelTalkProps = {
  pluginKey?: string;
  gaId?: string;
};

export function ChannelTalk({ pluginKey, gaId }: ChannelTalkProps) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const bootingRef = useRef(false);

  useEffect(() => {
    if (!pluginKey || loading) return;

    const key = pluginKey;
    let cancelled = false;

    async function syncIdentity() {
      if (bootingRef.current) return;
      bootingRef.current = true;

      try {
        const gaClientId = await getGaClientId(gaId);
        if (cancelled) return;

        if (user) {
          const idToken = await currentIdToken();
          if (cancelled) return;
          await bootChannelTalkAsMember(key, user, gaClientId, idToken);
        } else {
          await bootChannelTalkAsAnonymous(key, gaClientId);
        }
      } finally {
        bootingRef.current = false;
      }
    }

    syncIdentity();

    return () => {
      cancelled = true;
    };
  }, [pluginKey, gaId, user, loading]);

  useEffect(() => {
    if (!pluginKey || loading) return;
    syncChannelTalkRoute(pathname);
  }, [pluginKey, pathname, loading]);

  useEffect(() => {
    if (!pluginKey && process.env.NODE_ENV === "development") {
      console.warn(
        "[ChannelTalk] NEXT_PUBLIC_CHANNEL_TALK_PLUGIN_KEY is missing. Add it to .env.local and restart `npm run dev`.",
      );
    }
  }, [pluginKey]);

  return null;
}
