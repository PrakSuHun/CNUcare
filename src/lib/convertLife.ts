import { supabase } from "@/lib/supabase";

export type AttendeeLike = {
  id: string;
  name: string;
  department: string | null;
  year: number | null;
  gender: string | null;
  phone: string | null;
};

// 행사 참석자 → 생명 전환.
// 만남 경위 = 행사명, 특징 = 파악내용(+ 행사 참여 표기). primary_user_id = 담당자.
// 성공 시 생성된 life id 반환, 실패 시 throw.
export async function convertAttendeeToLife(opts: {
  attendee: AttendeeLike;
  primaryUserId: string;
  eventName: string;
  assessment?: string | null;
}): Promise<string> {
  const { attendee: a, primaryUserId, eventName, assessment } = opts;
  const characteristics = [assessment?.trim() || "", `[${eventName}] 참여`]
    .filter(Boolean)
    .join("\n");
  const { data: life, error } = await supabase
    .from("lives")
    .insert({
      name: a.name,
      stage: "first_meeting",
      department: a.department || null,
      age: a.year ? new Date().getFullYear() - (2000 + a.year) + 1 : null,
      gender: a.gender || null,
      phone: a.phone || null,
      meeting_reason: eventName, // 만남 경위 = 행사명
      characteristics, // 특징 = 파악내용
      primary_user_id: primaryUserId,
    })
    .select("id")
    .single();
  if (error || !life) throw new Error(error?.message || "생명 등록에 실패했습니다.");
  await supabase.from("user_lives").insert({ user_id: primaryUserId, life_id: life.id, role_in_life: "evangelist" });
  await supabase.from("event_attendees").update({ life_id: life.id }).eq("id", a.id);
  return life.id as string;
}
