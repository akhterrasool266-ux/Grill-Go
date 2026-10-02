import {
  LayoutDashboard, Users, UserPlus, ClipboardCheck, CalendarDays, Wallet, Receipt, AlertCircle, Landmark, GraduationCap, Trophy,
  ArrowUpCircle, BriefcaseBusiness, Banknote, Plane, Library, Bus, BedDouble, FolderOpen, MessageSquare, Megaphone, BarChart3,
  Settings, ScrollText, Shapes, ShieldCheck, Bell, Sparkles, Globe, Home, ScanLine, BookOpen, Clock, Search, Menu, X, Sun, Moon,
  Monitor, LogOut, ChevronDown, Plus, Printer, Download, Upload, Pencil, Trash2, Check, Building2, FileText, Languages, Heart, Inbox, QrCode, RefreshCw, Eye,
} from 'lucide-react';

const ICONS = {
  LayoutDashboard, Users, UserPlus, ClipboardCheck, CalendarDays, Wallet, Receipt, AlertCircle, Landmark, GraduationCap, Trophy,
  ArrowUpCircle, BriefcaseBusiness, Banknote, Plane, Library, Bus, BedDouble, FolderOpen, MessageSquare, Megaphone, BarChart3,
  Settings, ScrollText, Shapes, ShieldCheck, Bell, Sparkles, Globe, Home, ScanLine, BookOpen, Clock, Search, Menu, X, Sun, Moon,
  Monitor, LogOut, ChevronDown, Plus, Printer, Download, Upload, Pencil, Trash2, Check, Building2, FileText, Languages, Heart, Inbox, QrCode, RefreshCw, Eye,
} as const;
export type IconName = keyof typeof ICONS;

export function Icon({ name, className = 'size-[18px]', ...p }: { name: IconName; className?: string } & Omit<React.ComponentProps<'svg'>, 'name'>) {
  const C = ICONS[name];
  return <C className={className} aria-hidden strokeWidth={1.8} {...p} />;
}
