export interface User {
  id: string;
  login_id: string;
  name: string;
  role: "student" | "manager" | "instructor" | "admin";
  display_name: string;
}

export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  return JSON.parse(raw) as User;
}

export function logout() {
  localStorage.removeItem("user");
  window.location.href = "/";
}
