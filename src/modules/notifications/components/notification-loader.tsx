import { requireRole } from "@/modules/accounts/auth";
import { notificationInbox } from "../queries";
import type { NotificationInbox } from "../logic";
import { NotificationBell } from "./notification-bell";

export async function NotificationLoader() {
  const staff = await requireRole();
  let initial: NotificationInbox = { items: [], unreadCount: 0 };
  let initialError = false;
  try {
    initial = await notificationInbox(staff.id);
  } catch (error) {
    console.error("Unable to load staff notifications", error);
    initialError = true;
  }
  return (
    <NotificationBell
      key={staff.id}
      initial={initial}
      initialError={initialError}
    />
  );
}
