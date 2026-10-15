// Staff notifications: pure event policy, shared by all producers.
export const notificationPolicies = {
  sell_offer_created: { href: "/buying", role: "manager" },
  booking_created: { href: "/bookings", role: null },
  booking_cancelled: { href: "/bookings", role: null },
  reschedule_accepted: { href: "/bookings", role: null },
  reschedule_declined: { href: "/bookings", role: null },
  suggestion_created: { href: "/suggestions", role: "manager" },
  sms_failed: { href: "/sms", role: null },
  sms_attention: { href: "/sms", role: null },
} as const;
export type NotificationKind = keyof typeof notificationPolicies;
export type InboxItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  href: string;
  created_at: string;
  read_at: string | null;
};
export type NotificationInbox = { items: InboxItem[]; unreadCount: number };
export const POLL_MS = 15_000;
export function unreadLabel(count: number): string {
  return count > 99 ? "99+" : String(count);
}
