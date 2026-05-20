"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUser, saveUser } from "@/lib/auth";

// 역할에 따라 이동할 페이지 결정 (대학리더 = student role + is_college_leader → /manager)
function routeForUser(u: { role: string; is_college_leader?: boolean }): string {
  if (u.role === "student" && u.is_college_leader) return "/manager";
  switch (u.role) {
    case "admin": return "/admin";
    case "leader": return "/leader";
    case "instructor": return "/instructor";
    case "manager": return "/manager";
    default: return "/student";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 이미 로그인되어 있으면 DB에서 최신 권한을 다시 확인 후 자동 리다이렉트
  // (어드민이 역할을 바꿔도 오래된 세션이 그대로 남아 잘못된 페이지로 가던 문제 방지)
  useEffect(() => {
    const cached = getUser();
    if (!cached) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("users")
        .select("id, login_id, name, role, display_name, is_college_leader")
        .eq("id", cached.id)
        .single();
      if (!active) return;
      if (data) saveUser(data); // 세션 갱신
      router.replace(routeForUser(data ?? cached));
    })();
    return () => { active = false; };
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error: dbError } = await supabase
      .from("users")
      .select("id, login_id, name, role, display_name, is_college_leader")
      .eq("login_id", loginId)
      .eq("password", password)
      .single();

    if (dbError || !data) {
      setError("아이디 또는 비밀번호가 틀렸습니다.");
      setLoading(false);
      return;
    }

    // 세션 저장 (localStorage + 쿠키)
    saveUser(data);

    // 역할별 리다이렉트
    router.push(routeForUser(data));
  };

  return (
    <div className="flex min-h-full items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-3xl font-bold text-gray-900 mb-2">
          CNUcare
        </h1>
        <p className="text-center text-sm text-gray-500 mb-8">
          충남대 종합 관리 시스템
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="아이디"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="비밀번호 (4자리)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={4}
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => router.push("/signup")}
            className="text-sm text-blue-600 hover:underline"
          >
            가입하기
          </button>
        </div>
      </div>
    </div>
  );
}
