import React from "react";

export type UserRole = "contractor" | "supervisor" | "worker";

export interface NavItemConfig {
  id: string;
  name: string;
  titleKey: string;
  defaultTitle: string;
  iconName: string;
  iconFamily?: "Feather" | "Ionicons" | "MaterialCommunityIcons";
  isCenterAction?: boolean;
}

/**
 * Normalize arbitrary user role strings to standard UserRole.
 */
export function getNormalizedRole(role?: string | null): UserRole {
  const r = (role || "").toLowerCase().trim();
  if (r === "supervisor") return "supervisor";
  if (r === "labor" || r === "labour" || r === "worker") return "worker";
  return "contractor";
}

/**
 * CONTRACTOR NAVIGATION
 * Exact Order: 1. Dashboard, 2. Workers, 3. QR Scanner (Center), 4. Summary, 5. Site Control
 */
export const CONTRACTOR_NAV: NavItemConfig[] = [
  {
    id: "dashboard",
    name: "DashboardTab",
    titleKey: "nav.dashboard",
    defaultTitle: "Dashboard",
    iconName: "grid",
    iconFamily: "Feather",
  },
  {
    id: "workers",
    name: "WorkersTab",
    titleKey: "nav.workers",
    defaultTitle: "Workers",
    iconName: "users",
    iconFamily: "Feather",
  },
  {
    id: "qrScanner",
    name: "ScanQRTab",
    titleKey: "nav.qrScanner",
    defaultTitle: "Scan QR",
    iconName: "maximize",
    iconFamily: "Feather",
    isCenterAction: true,
  },
  {
    id: "summary",
    name: "SummaryTab",
    titleKey: "nav.summary",
    defaultTitle: "Summary",
    iconName: "bar-chart-2",
    iconFamily: "Feather",
  },
  {
    id: "siteControl",
    name: "SiteControlTab",
    titleKey: "nav.siteControl",
    defaultTitle: "Site Control",
    iconName: "layers",
    iconFamily: "Feather",
  },
];

/**
 * SUPERVISOR NAVIGATION
 * Uses the exact same structure as Contractor:
 * Exact Order: 1. Dashboard, 2. Workers, 3. QR Scanner (Center), 4. Summary, 5. Site Control
 */
export const SUPERVISOR_NAV: NavItemConfig[] = [
  {
    id: "dashboard",
    name: "DashboardTab",
    titleKey: "nav.dashboard",
    defaultTitle: "Dashboard",
    iconName: "grid",
    iconFamily: "Feather",
  },
  {
    id: "workers",
    name: "WorkersTab",
    titleKey: "nav.workers",
    defaultTitle: "Workers",
    iconName: "users",
    iconFamily: "Feather",
  },
  {
    id: "qrScanner",
    name: "ScanQRTab",
    titleKey: "nav.qrScanner",
    defaultTitle: "Scan QR",
    iconName: "maximize",
    iconFamily: "Feather",
    isCenterAction: true,
  },
  {
    id: "summary",
    name: "SummaryTab",
    titleKey: "nav.summary",
    defaultTitle: "Summary",
    iconName: "bar-chart-2",
    iconFamily: "Feather",
  },
  {
    id: "siteControl",
    name: "SiteControlTab",
    titleKey: "nav.siteControl",
    defaultTitle: "Site Control",
    iconName: "layers",
    iconFamily: "Feather",
  },
];

/**
 * WORKER NAVIGATION
 * Simplified navigation with only 3 allowed destinations:
 * Exact Order: 1. Dashboard, 2. QR Scanner (Center), 3. Summary
 * No disabled placeholders for hidden items.
 */
export const WORKER_NAV: NavItemConfig[] = [
  {
    id: "dashboard",
    name: "DashboardTab",
    titleKey: "nav.dashboard",
    defaultTitle: "Dashboard",
    iconName: "grid",
    iconFamily: "Feather",
  },
  {
    id: "qrScanner",
    name: "ScanQRTab",
    titleKey: "nav.qrScanner",
    defaultTitle: "Scan QR",
    iconName: "maximize",
    iconFamily: "Feather",
    isCenterAction: true,
  },
  {
    id: "summary",
    name: "SummaryTab",
    titleKey: "nav.summary",
    defaultTitle: "Summary",
    iconName: "bar-chart-2",
    iconFamily: "Feather",
  },
];

/**
 * Get the navigation item configuration list for the specified role.
 */
export function getNavigationForRole(role?: string | null): NavItemConfig[] {
  const normalized = getNormalizedRole(role);
  switch (normalized) {
    case "worker":
      return WORKER_NAV;
    case "supervisor":
      return SUPERVISOR_NAV;
    case "contractor":
    default:
      return CONTRACTOR_NAV;
  }
}
