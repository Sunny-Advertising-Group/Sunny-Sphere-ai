export type NavItem = {
  href: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
  section?: string;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/tools", label: "Tools", icon: "🛠" },
  { href: "/could-this-be-aid", label: "Could this be AI'd?", icon: "💡" },
  { href: "/tips", label: "Tips & Prompts", icon: "✨" },
  { href: "/atl", label: "ATL", icon: "📊", section: "atl" },
  { href: "/agency", label: "Agency", icon: "🏢" },
  { href: "/learning", label: "Learning", icon: "🎓" },
  { href: "/support", label: "Support", icon: "🆘" },
  { href: "/admin", label: "Admin", icon: "⚙️", adminOnly: true },
];
