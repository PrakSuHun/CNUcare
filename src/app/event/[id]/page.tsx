"use client";
// 알림에서 진입하는 역할 무관 행사 라우트. 로그인 역할에 맞는 행사 상세로 리다이렉트.
// (행사 상세는 /manager/event/[id] · /student/event/[id] 만 존재 — 나머지 역할은 manager 뷰 사용)
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";

export default function EventEntryPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  useEffect(() => {
    const u = getUser();
    if (!u) {
      // 로그인 후 원래 행사로 돌아오도록 next 파라미터 전달
      router.replace(`/?next=${encodeURIComponent(`/event/${id}`)}`);
      return;
    }
    const isStudent = u.role === "student" && !u.is_college_leader;
    const base = isStudent ? "/student" : "/manager";
    router.replace(`${base}/event/${id}`);
  }, [id, router]);

  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-gray-400 text-sm">행사로 이동 중…</p>
    </div>
  );
}
