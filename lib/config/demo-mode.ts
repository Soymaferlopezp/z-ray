// lib/config/demo-mode.ts
export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("demo") === "1";
}

export function withDemoQS(path: string): string {
  if (typeof window === "undefined") return path;
  return isDemoMode() ? `${path}?demo=1` : path;
}
