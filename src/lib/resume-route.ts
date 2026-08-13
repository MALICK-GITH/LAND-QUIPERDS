const LAST_AUTH_ROUTE_KEY = "skill2cash:last-auth-route";

export function getLastAuthRoute(): string | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(LAST_AUTH_ROUTE_KEY);
  if (!value || !value.startsWith("/")) return null;
  if (value.startsWith("/auth")) return null;
  return value;
}

export function setLastAuthRoute(path: string): void {
  if (typeof window === "undefined") return;
  if (!path || !path.startsWith("/")) return;
  if (path.startsWith("/auth")) return;
  window.localStorage.setItem(LAST_AUTH_ROUTE_KEY, path);
}

export function clearLastAuthRoute(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LAST_AUTH_ROUTE_KEY);
}
