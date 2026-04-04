export interface User {
  id: string;
  login_id: string;
  name: string;
  role: "student" | "manager" | "instructor" | "leader" | "admin";
  display_name: string;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
}

export function getUser(): User | null {
  if (typeof window === "undefined") return null;

  // localStorage 우선
  const raw = localStorage.getItem("user");
  if (raw) return JSON.parse(raw) as User;

  // iOS PWA 종료 시 localStorage가 날아가므로 쿠키에서 복원
  const cookie = getCookie("cnu_user");
  if (cookie) {
    try {
      const user = JSON.parse(cookie) as User;
      localStorage.setItem("user", cookie);
      return user;
    } catch { /* ignore */ }
  }

  return null;
}

export function saveUser(user: User) {
  const json = JSON.stringify(user);
  localStorage.setItem("user", json);
  setCookie("cnu_user", json, 90); // 90일 유지
}

export function logout() {
  localStorage.removeItem("user");
  deleteCookie("cnu_user");
  window.location.href = "/";
}
