/** Light, dark or the device's own setting. Stored in a cookie so the server renders the right theme. */
export type Theme = "light" | "dark" | "system";

export const THEME_COOKIE = "tronic-admin-theme";
export const SIDEBAR_COOKIE = "tronic-admin-sidebar";

export function parseTheme(value: string | undefined): Theme {
  return value === "light" || value === "dark" ? value : "system";
}

export function nextTheme(theme: Theme): Theme {
  return theme === "system" ? "light" : theme === "light" ? "dark" : "system";
}

export const THEME_LABEL: Record<Theme, string> = { system: "Device theme", light: "Light theme", dark: "Dark theme" };
