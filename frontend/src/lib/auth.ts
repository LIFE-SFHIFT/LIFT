// 액세스 토큰을 localStorage에 보관하는 최소 인증 유틸.
// MVP용이며, 실서비스에서는 httpOnly 쿠키 등 더 안전한 저장소로 교체한다.

const TOKEN_KEY = "lift.accessToken";
const DEMO_KEY = "lift.demoSession";
const DEMO_TOKEN = "demo-local-session";

export function saveToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DEMO_KEY);
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function startDemoSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEMO_KEY, "1");
  window.localStorage.setItem(TOKEN_KEY, DEMO_TOKEN);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(DEMO_KEY);
}

export function isDemoSession(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(DEMO_KEY) === "1";
}

export function isLoggedIn(): boolean {
  return getToken() !== null;
}
