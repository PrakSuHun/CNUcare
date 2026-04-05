"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminViewBanner() {
  const router = useRouter();
  const [isViewing, setIsViewing] = useState(false);

  useEffect(() => {
    setIsViewing(!!localStorage.getItem("admin_backup"));
  }, []);

  if (!isViewing) return null;

  const handleReturn = () => {
    const backup = localStorage.getItem("admin_backup");
    if (backup) {
      localStorage.setItem("user", backup);
      localStorage.removeItem("admin_backup");
    }
    router.push("/admin");
  };

  return (
    <div className="bg-red-500 text-white text-center py-1.5 text-xs font-medium shrink-0 flex items-center justify-center gap-2">
      <span>관리자 미리보기 모드</span>
      <button onClick={handleReturn} className="bg-white text-red-500 rounded-full px-3 py-0.5 text-xs font-bold">
        어드민으로 돌아가기
      </button>
    </div>
  );
}
