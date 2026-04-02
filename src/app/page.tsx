"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error: dbError } = await supabase
      .from("users")
      .select("id, login_id, name, role, display_name")
      .eq("login_id", loginId)
      .eq("password", password)
      .single();

    if (dbError || !data) {
      setError("아이디 또는 비밀번호가 틀렸습니다.");
      setLoading(false);
      return;
    }

    // 세션 저장
    localStorage.setItem("user", JSON.stringify(data));

    // 역할별 리다이렉트
    switch (data.role) {
      case "admin":
        router.push("/admin");
        break;
      case "instructor":
        router.push("/instructor");
        break;
      case "manager":
        router.push("/manager");
        break;
      default:
        router.push("/student");
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-3xl font-bold text-gray-900 mb-2">
          CNUcare
        </h1>
        <p className="text-center text-sm text-gray-500 mb-8">
          선교 관리 서비스
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
