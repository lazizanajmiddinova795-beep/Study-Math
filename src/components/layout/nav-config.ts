import {
  BookOpen, ClipboardList, Sparkles, TrendingUp, MessageSquare, Calculator, LayoutDashboard,
  Users, FileText, BarChart3, Wand2, ShieldCheck, Settings, ScrollText, UserCog, Network,
  type LucideIcon,
} from "lucide-react";
import type { Area } from "@/lib/auth/policy";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV: Record<Area, NavItem[]> = {
  student: [
    { href: "/student", label: "Dashboard", icon: LayoutDashboard },
    { href: "/student/learning", label: "Learning", icon: BookOpen },
    { href: "/student/exams", label: "Mock exams", icon: ClipboardList },
    { href: "/student/tutor", label: "AI tutor", icon: Sparkles },
    { href: "/student/progress", label: "Progress", icon: TrendingUp },
    { href: "/student/messages", label: "Messages", icon: MessageSquare },
    { href: "/student/tools", label: "Math tools", icon: Calculator },
  ],
  teacher: [
    { href: "/teacher", label: "Overview", icon: LayoutDashboard },
    { href: "/teacher/groups", label: "Groups & students", icon: Users },
    { href: "/teacher/materials", label: "Learning materials", icon: FileText },
    { href: "/teacher/exams", label: "Mock exams", icon: ClipboardList },
    { href: "/teacher/results", label: "Results & analytics", icon: BarChart3 },
    { href: "/teacher/messages", label: "Messages", icon: MessageSquare },
    { href: "/teacher/ai-prep", label: "AI content prep", icon: Wand2 },
  ],
  admin: [
    { href: "/admin", label: "Users & approvals", icon: UserCog },
    { href: "/admin/groups", label: "Groups & members", icon: Users },
    { href: "/admin/assignments", label: "Teacher assignments", icon: Network },
    { href: "/admin/settings", label: "Platform configuration", icon: Settings },
    { href: "/admin/audit", label: "Audit records", icon: ScrollText },
  ],
};

export const AREA_LABEL: Record<Area, string> = {
  student: "Student",
  teacher: "Teacher",
  admin: "Administrator",
};

export const AREA_ICON = ShieldCheck;
