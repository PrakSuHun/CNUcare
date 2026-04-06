"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    loginId: "",
    password: "",
    passwordConfirm: "",
    name: "",
    birthDate: "",
    phone: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const updateForm = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    if (form.password.length !== 4) {
      setError("비밀번호는 4자리로 입력해주세요.");
      return;
    }

    setLoading(true);

    // 아이디 중복 확인
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("login_id", form.loginId)
      .single();

    if (existing) {
      setError("이미 사용 중인 아이디입니다.");
      setLoading(false);
      return;
    }

    // 이름+전화번호 중복 확인
    const { data: dupUser } = await supabase
      .from("users")
      .select("id, display_name, phone")
      .eq("name", form.name)
      .eq("phone", form.phone)
      .limit(1);

    if (dupUser && dupUser.length > 0) {
      setError(`동일한 이름과 전화번호로 가입된 계정이 있습니다. (${dupUser[0].display_name})`);
      setLoading(false);
      return;
    }

    const displayName = form.name;

    const { error: insertError } = await supabase.from("users").insert({
      login_id: form.loginId,
      password: form.password,
      name: form.name,
      birth_date: form.birthDate,
      phone: form.phone,
      role: "student",
      display_name: displayName,
    });

    if (insertError) {
      setError("가입에 실패했습니다. 다시 시도해주세요.");
      setLoading(false);
      return;
    }

    alert("가입이 완료되었습니다!");
    router.push("/");
  };

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-bold text-gray-900 mb-6">
          회원가입
        </h1>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              아이디
            </label>
            <input
              type="text"
              value={form.loginId}
              onChange={(e) => updateForm("loginId", e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              비밀번호 (4자리)
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => updateForm("password", e.target.value)}
              maxLength={4}
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              비밀번호 확인
            </label>
            <input
              type="password"
              value={form.passwordConfirm}
              onChange={(e) => updateForm("passwordConfirm", e.target.value)}
              maxLength={4}
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이름
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateForm("name", e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              생년월일
            </label>
            <input
              type="date"
              value={form.birthDate}
              onChange={(e) => updateForm("birthDate", e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              전화번호
            </label>
            <input
              type="tel"
              placeholder="010-0000-0000"
              value={form.phone}
              onChange={(e) => updateForm("phone", e.target.value)}
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
            {loading ? "가입 중..." : "가입하기"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => router.push("/")}
            className="text-sm text-gray-500 hover:underline"
          >
            로그인으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}
