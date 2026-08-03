"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getGaClientId } from "@/lib/ga-client-id";
import {
  bootChannelTalkAsAnonymous,
  bootChannelTalkAsMember,
  syncChannelTalkRoute,
} from "@/lib/channel-talk";

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
          await bootChannelTalkAsMember(key, user, gaClientId);
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
