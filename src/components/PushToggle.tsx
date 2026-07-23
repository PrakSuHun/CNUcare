"use client";
import { useEffect, useState } from "react";
import { getUser } from "@/lib/auth";
import { isIos, isStandalone, isSubscribed, pushSupported, subscribePush, unsubscribePush } from "@/lib/push";

// 헤더용 컴팩트 알림 벨. 켜짐=파랑, 꺼짐=회색.
export default function PushToggle() {
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (pushSupported()) isSubscribed().then(setOn);
    else if (isIos()) setOn(false); // iOS 미설치 → 켜기 유도용으로 노출
    else setOn(null); // 데스크톱 미지원 → 숨김
  }, []);

  if (on === null) return null;

  async function toggle() {
    setBusy(true);
    try {
      if (!on && isIos() && !isStandalone()) {
        alert("아이폰은 사파리 하단 공유 → '홈 화면에 추가' 후, 홈 화면의 CNUcare 아이콘으로 열어서 알림을 켜주세요.");
        return;
      }
      if (on) {
        await unsubscribePush();
        setOn(false);
      } else {
        const u = getUser();
        if (!u) throw new Error("로그인이 필요합니다.");
        await subscribePush(u.id, u.display_name || u.name);
        setOn(true);
        alert("알림이 켜졌습니다. 약속 후 일지 미작성·행사 신청 알림을 받습니다.");
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={on ? "알림 켜짐 (누르면 끄기)" : "알림 켜기"}
      aria-label={on ? "알림 끄기" : "알림 켜기"}
      className={`text-base leading-none ${on ? "text-blue-600" : "text-gray-400 hover:text-gray-600"} disabled:opacity-50`}
    >
      {busy ? "…" : on ? "🔔" : "🔕"}
    </button>
  );
}
