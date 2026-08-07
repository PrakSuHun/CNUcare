"use client";
// 알림에서 진입하는 역할 무관 생명 라우트. 로그인 역할에 맞는 생명 상세로 리다이렉트.
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";

export default function LifeEntryPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace(`/?next=${encodeURIComponent(`/life/${id}`)}`);
      return;
    }
    let base = "/manager";
    if (u.role === "student" && !u.is_college_leader) base = "/student";
    else if (u.role === "leader" || u.is_college_leader) base = "/leader";
    else if (u.role === "instructor") base = "/instructor";
    else if (u.role === "admin") base = "/admin";
    router.replace(`${base}/life/${id}`);
  }, [id, router]);

  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-gray-400 text-sm">생명 정보로 이동 중…</p>
    </div>
  );
}
