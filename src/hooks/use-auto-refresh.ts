"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-fetches the page's server data every `ms` while the tab is visible, and
 * right away when it becomes visible again, so rows written elsewhere (SMS,
 * other staff) appear without a reload. Client state such as filters and open
 * forms is kept.
 */
export function useAutoRefresh(ms: number) {
  const router = useRouter();
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      timer ??= setInterval(() => router.refresh(), ms);
    };
    const stop = () => {
      clearInterval(timer);
      timer = undefined;
    };
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return stop();
      router.refresh();
      start();
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router, ms]);
}
