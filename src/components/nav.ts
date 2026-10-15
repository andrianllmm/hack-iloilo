import {
  Banknote,
  Boxes,
  ChartColumn,
  ChartSpline,
  ClipboardList,
  DoorOpen,
  Lightbulb,
  Settings2,
  Users,
  Wheat,
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

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const nav: NavGroup[] = [
  {
    label: "Plan",
    items: [
      { title: "Capacity", href: "/", icon: ChartColumn },
      { title: "Suggestions", href: "/suggestions", icon: Lightbulb },
      { title: "Forecast", href: "/forecast", icon: ChartSpline },
    ],
  },
  {
    label: "Operate",
    items: [
      { title: "Gate queue", href: "/queue", icon: DoorOpen },
      { title: "Batches", href: "/batches", icon: Boxes },
      { title: "Bookings", href: "/bookings", icon: ClipboardList },
      { title: "Buying", href: "/buying", icon: Wheat },
    ],
  },
  {
    label: "Admin",
    items: [
      {
        title: "Pricing & cost",
        href: "/prices",
        icon: Banknote,
        role: "manager",
      },
      { title: "Clients & staff", href: "/clients", icon: Users },
      {
        title: "Settings",
        href: "/settings",
        icon: Settings2,
        role: "manager",
      },
    ],
  },
];
