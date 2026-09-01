import {
  BarChart3,
  Building2,
  GraduationCap,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  Settings,
  Target,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  section?: string;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tools", label: "Tools", icon: Wrench },
  { href: "/could-this-be-aid", label: "Could this be AI'd?", icon: Lightbulb },
  { href: "/tasks", label: "Task Management", icon: ListChecks },
  { href: "/atl", label: "ATL", icon: BarChart3, section: "atl" },
  { href: "/digital-opti", label: "Digital", icon: Target, section: "digital_opti" },
  { href: "/agency", label: "Agency", icon: Building2 },
  { href: "/learning", label: "Learning", icon: GraduationCap },
  { href: "/admin", label: "Admin", icon: Settings, adminOnly: true },
];
