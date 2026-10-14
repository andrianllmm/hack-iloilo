import {
  ClipboardList,
  Gauge,
  HandCoins,
  MessageSquare,
  Package,
  Settings,
  Tags,
  Users,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";
import type { StaffRole } from "@/modules/accounts/auth";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Minimum role; omit for all staff. */
  role?: StaffRole;
};

export const nav: NavItem[] = [
  { title: "Capacity", href: "/", icon: Gauge },
  { title: "Bookings", href: "/bookings", icon: CalendarDays },
  { title: "Buying", href: "/buying", icon: HandCoins },
  { title: "Queue", href: "/queue", icon: ClipboardList },
  { title: "Batches", href: "/batches", icon: Package },
  { title: "Clients", href: "/clients", icon: Users },
  { title: "SMS simulator", href: "/sms", icon: MessageSquare },
  { title: "Prices", href: "/prices", icon: Tags, role: "manager" },
  { title: "Settings", href: "/settings", icon: Settings, role: "manager" },
];
