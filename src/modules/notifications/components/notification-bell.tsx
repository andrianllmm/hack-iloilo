"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { BellIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  markAllNotificationsRead,
  markNotificationRead,
  refreshNotifications,
} from "../actions";
import { POLL_MS, unreadLabel, type NotificationInbox } from "../logic";

const timestamp = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function NotificationBell({
  initial,
  initialError = false,
}: {
  initial: NotificationInbox;
  initialError?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [inbox, setInbox] = useState(initial);
  const [error, setError] = useState(initialError);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const fetching = useRef(false);
  const mutating = useRef(false);
  const version = useRef(0);
  const refresh = useCallback(async () => {
    if (
      fetching.current ||
      mutating.current ||
      document.visibilityState !== "visible"
    )
      return;
    fetching.current = true;
    const requested = version.current;
    try {
      const next = await refreshNotifications();
      if (requested === version.current) {
        setInbox(next);
        setError(false);
      }
    } catch {
      if (requested === version.current) setError(true);
    } finally {
      fetching.current = false;
    }
  }, []);

  useEffect(() => {
    const initialRefresh = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(), POLL_MS);
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearTimeout(initialRefresh);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [pathname, refresh]);

  function markRead(id?: string, href?: string) {
    version.current += 1;
    mutating.current = true;
    startTransition(async () => {
      try {
        const next = id
          ? await markNotificationRead(id)
          : await markAllNotificationsRead();
        setInbox(next);
        setError(false);
        if (href) {
          setOpen(false);
          router.push(href);
        }
      } catch {
        setError(true);
      } finally {
        mutating.current = false;
      }
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Notifications, ${inbox.unreadCount} unread`}
          />
        }
      >
        <BellIcon data-icon="inline-start" />
        {inbox.unreadCount > 0 ? (
          <Badge variant="secondary">{unreadLabel(inbox.unreadCount)}</Badge>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        <PopoverHeader>
          <PopoverTitle>Notifications</PopoverTitle>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending || inbox.unreadCount === 0}
            onClick={() => markRead()}
          >
            Mark all as read
          </Button>
        </PopoverHeader>
        {error ? (
          <p role="status" className="text-sm text-muted-foreground">
            Notifications couldn&apos;t refresh.{" "}
            <Button variant="link" size="sm" onClick={() => void refresh()}>
              Retry
            </Button>
          </p>
        ) : null}
        <Separator />
        {inbox.items.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No notifications yet.
          </p>
        ) : (
          <ScrollArea className="h-80">
            <ul className="flex flex-col gap-2 pr-3">
              {inbox.items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-1 rounded-md border p-3"
                >
                  <div className="flex items-start gap-2">
                    <Link
                      href={item.href}
                      className="flex-1 text-sm font-medium hover:underline"
                      onClick={(event) => {
                        if (
                          event.metaKey ||
                          event.ctrlKey ||
                          event.shiftKey ||
                          event.altKey
                        )
                          return;
                        event.preventDefault();
                        if (!pending) markRead(item.id, item.href);
                      }}
                    >
                      {item.title}
                    </Link>
                    {!item.read_at ? (
                      <Badge variant="secondary">Unread</Badge>
                    ) : null}
                  </div>
                  <time
                    className="text-xs text-muted-foreground"
                    dateTime={item.created_at}
                  >
                    {timestamp.format(new Date(item.created_at))}
                  </time>
                  {!item.read_at ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      aria-label={`Mark as read: ${item.title}`}
                      onClick={() => markRead(item.id)}
                    >
                      Mark as read
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
