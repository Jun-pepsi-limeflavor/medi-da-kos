"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getGaClientId } from "@/lib/ga-client-id";
import {
  bootChannelTalkAsAnonymous,
  bootChannelTalkAsMember,
  shutdownChannelTalk,
  syncChannelTalkPage,
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
          bootChannelTalkAsAnonymous(key, gaClientId);
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
    syncChannelTalkPage(pathname);
  }, [pluginKey, pathname, loading]);

  useEffect(() => {
    return () => {
      shutdownChannelTalk();
    };
  }, []);

  return null;
}
