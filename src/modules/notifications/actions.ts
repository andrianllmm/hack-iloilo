"use server";

import { z } from "zod";
import { requireRole } from "@/modules/accounts/auth";
import { prescriptions } from "@/modules/prescriptions/queries";
import { notificationInbox, notify, readNotifications } from "./queries";

export async function refreshNotifications() {
  const staff = await requireRole();
  if (staff.role === "manager") {
    try {
      const suggestions = await prescriptions();
      await Promise.all(
        suggestions
          .filter(
            (s) =>
              !s.decision &&
              (s.kind === "move_bookings" || s.kind === "fill_idle"),
          )
          .map((s) =>
            notify({
              kind: "suggestion_created",
              entityId: s.key,
              title: s.title,
            }),
          ),
      );
    } catch (error) {
      console.error("Unable to discover notification suggestions", error);
    }
  }
  return notificationInbox(staff.id);
}

export async function markNotificationRead(id: string) {
  const staff = await requireRole();
  await readNotifications(staff.id, z.guid().parse(id));
  return notificationInbox(staff.id);
}

export async function markAllNotificationsRead() {
  const staff = await requireRole();
  await readNotifications(staff.id);
  return notificationInbox(staff.id);
}
