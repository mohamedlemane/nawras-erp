import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  FileText, 
  FileCheck, 
  FileSignature, 
  CreditCard,
  UserCircle,
  Building2,
  Briefcase,
  ScrollText,
  CalendarDays,
  Clock,
  Files,
  ShieldCheck,
  Building,
  ActivitySquare,
  LogOut,
  ChevronDown,
  Settings,
  FolderKanban,
  ClipboardList,
  TrendingDown,
  Tag,
  Plug,
  BarChart3,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const NAV_ITEMS = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Facturation",
    icon: FileText,
    items: [
      { title: "Clients/Fournisseurs", href: "/billing/partners", icon: Users },
      { title: "Produits & Services", href: "/billing/products", icon: Package },
      { title: "Devis", href: "/billing/quotes", icon: FileText },
      { title: "Proformas", href: "/billing/proformas", icon: FileCheck },
      { title: "Factures", href: "/billing/invoices", icon: FileSignature },
      { title: "Paiements", href: "/billing/payments", icon: CreditCard },
    ],
  },
  {
    title: "Projets",
    icon: FolderKanban,
    items: [
      { title: "Consultations / RFQ", href: "/projects/consultations", icon: ClipboardList },
      { title: "Projets en cours",    href: "/projects/list",         icon: FolderKanban },
      { title: "Statistiques",        href: "/projects/stats",        icon: BarChart3 },
      { title: "Paramètres",          href: "/projects/settings",     icon: Settings },
    ],
  },
  {
    title: "RH",
    icon: UserCircle,
    items: [
      { title: "Employés", href: "/hr/employees", icon: UserCircle },
      { title: "Départements", href: "/hr/departments", icon: Building2 },
      { title: "Postes", href: "/hr/positions", icon: Briefcase },
      { title: "Contrats", href: "/hr/contracts", icon: ScrollText },
      { title: "Congés", href: "/hr/leaves", icon: CalendarDays },
      { title: "Types de congé", href: "/hr/leave-types", icon: Tag },
      { title: "Présences", href: "/hr/attendances", icon: Clock },
      { title: "Documents", href: "/hr/documents", icon: Files },
    ],
  },
  {
    title: "Dépenses",
    icon: TrendingDown,
    items: [
      { title: "Toutes les dépenses", href: "/expenses", icon: TrendingDown },
      { title: "Types de charges", href: "/expenses/types", icon: Tag },
    ],
  },
  {
    title: "Administration",
    icon: ShieldCheck,
    adminOnly: true,
    items: [
      { title: "Utilisateurs", href: "/admin/users", icon: Users },
      { title: "Rôles & Permissions", href: "/admin/roles", icon: ShieldCheck },
      { title: "Entreprises", href: "/admin/companies", icon: Building, platformOnly: true },
      { title: "Journal d'activité", href: "/admin/audit-logs", icon: ActivitySquare },
    ],
  },
  {
    title: "Paramètres",
    icon: Settings,
    items: [
      { title: "Mon Entreprise", href: "/settings/company", icon: Building2 },
      { title: "Intégrations & Webhooks", href: "/settings/integrations", icon: Plug },
    ],
  },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout, isAdmin } = useAuth();

  const visibleItems = NAV_ITEMS
    .filter(item => {
      if ((item as any).adminOnly) return user?.isSuperAdmin || isAdmin();
      return true;
    })
    .map(item => {
      if (!item.items) return item;
      return {
        ...item,
        items: item.items.filter((sub: any) => {
          if (sub.platformOnly) return user?.isSuperAdmin;
          return true;
        }),
      };
    });

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar border-r border-sidebar-border">
      <div className="flex h-16 items-center px-4 border-b border-sidebar-border">
        <div className="flex flex-col gap-0.5">
          <img
            src={`${BASE}/logo.svg`}
            alt="CTA-One"
            className="h-12 w-auto object-contain"
          />
          {user?.isSuperAdmin && (
            <span className="text-[10px] font-semibold text-purple-500 uppercase tracking-widest">
              Super Admin
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <nav className="grid gap-1 px-2">
          {visibleItems.map((item, index) => {
            if (item.items) {
              return (
                <Collapsible
                  key={index}
                  defaultOpen={item.items.some((subItem) => location.startsWith(subItem.href))}
                >
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors group">
                    <div className="flex items-center">
                      <item.icon className="mr-3 h-4 w-4" />
                      {item.title}
                    </div>
                    <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1 px-3 pt-1 pb-2">
                    {item.items.map((subItem, subIndex) => (
                      <Link
                        key={subIndex}
                        href={subItem.href}
                        className={cn(
                          "flex w-full items-center rounded-md px-3 py-2 text-sm transition-colors",
                          location.startsWith(subItem.href)
                            ? "bg-sidebar-primary/10 text-sidebar-primary font-medium"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <subItem.icon className="mr-3 h-4 w-4 opacity-70" />
                        {subItem.title}
                      </Link>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              );
            }

            return (
              <Link
                key={index}
                href={(item as any).href}
                className={cn(
                  "flex w-full items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  location === (item as any).href
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="mr-3 h-4 w-4" />
                {item.title}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full font-medium text-sm",
            user?.isSuperAdmin ? "bg-purple-100 text-purple-700" : "bg-primary/10 text-primary"
          )}>
            {user?.firstName?.[0] || user?.email?.[0] || "?"}
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm font-medium text-foreground truncate">
              {user?.firstName} {user?.lastName}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {user?.email}
            </span>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="mr-3 h-4 w-4" />
          Déconnexion
        </button>
      </div>
    </div>
  );
}
