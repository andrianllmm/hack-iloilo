import "server-only";
import { db } from "@/lib/supabase/admin";
import {
  notificationPolicies,
  type NotificationKind,
  type NotificationInbox,
} from "./logic";

/** A failed alert must never fail a booking, SMS, or other originating operation. */
export async function notify(input: {
  kind: NotificationKind;
  title: string;
  entityId: string;
}): Promise<void> {
  try {
    const { error } = await db()
      .from("notifications")
      .upsert(
        {
          kind: input.kind,
          title: input.title,
          entity_id: input.entityId,
          ...notificationPolicies[input.kind],
        },
        { onConflict: "kind,entity_id", ignoreDuplicates: true },
      );
    if (error) throw error;
  } catch (error) {
    console.error("Unable to create staff notification", error);
  }
}

/** Trusted server callers supply the ID obtained from requireRole(). */
export async function notificationInbox(
  staffId: string,
): Promise<NotificationInbox> {
  const { data, error } = await db().rpc("staff_notification_inbox", {
    p_staff_id: staffId,
  });
  if (error) throw error;
  return data as unknown as NotificationInbox;
}

export async function readNotifications(
  staffId: string,
  notificationId?: string,
): Promise<void> {
  const { error } = await db().rpc("read_staff_notifications", {
    p_staff_id: staffId,
    ...(notificationId && { p_notification_id: notificationId }),
  });
  if (error) throw error;
}
