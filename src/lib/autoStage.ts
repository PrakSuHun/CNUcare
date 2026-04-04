import { supabase } from "@/lib/supabase";

// 강의 진도에 따라 정확한 단계 계산 후 반영
export async function autoUpdateByLessons(lifeId: string) {
  const { data: life } = await supabase
    .from("lives")
    .select("stage")
    .eq("id", lifeId)
    .single();

  if (!life || life.stage === "completed") return; // 수료는 건드리지 않음

  const { data: checks } = await supabase
    .from("lesson_checks")
    .select("lesson_id, lessons(number)")
    .eq("life_id", lifeId);

  const numbers = (checks || []).map((c: any) => c.lessons?.number).filter(Boolean);

  const introComplete = [1, 2, 3, 4, 5].every((n) => numbers.includes(n));
  const beginnerComplete = introComplete && [6, 7, 8, 9, 10].every((n) => numbers.includes(n));
  const intermediateComplete = beginnerComplete && [11, 12, 13, 14, 15, 16, 17, 18, 19].every((n) => numbers.includes(n));
  const advancedComplete = intermediateComplete && [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30].every((n) => numbers.includes(n));

  // 진도에 맞는 정확한 단계 계산
  let correctStage: string;
  if (advancedComplete) correctStage = "advanced";
  else if (intermediateComplete) correctStage = "intermediate";
  else if (beginnerComplete) correctStage = "beginner";
  else if (introComplete) correctStage = "beginner";
  else if (numbers.length > 0) correctStage = "intro";
  else return; // 체크된 강의 없으면 변경 안 함

  // 강의 체크가 있으면 최소 입문 이상으로 설정
  // 현재 단계가 강의 관련이면 진도에 맞게 조정 (뒤로도 가능)
  const lectureStages = ["intro", "beginner", "intermediate", "advanced"];
  if (lectureStages.includes(life.stage)) {
    await supabase.from("lives").update({ stage: correctStage }).eq("id", lifeId);
  } else {
    // 1차 만남/전초연결/전초 등에서도 강의 체크하면 입문 이상으로 올림
    await autoUpdateStage(lifeId, correctStage);
  }
}

// 특정 단계로 업데이트 (앞으로만, 수료 제외)
export async function autoUpdateStage(lifeId: string, newStage: string) {
  if (newStage === "completed") return;

  const STAGE_PRIORITY: Record<string, number> = {
    first_meeting: 0, pre_visit_connect: 1, pre_visit: 2,
    intro: 3, beginner: 4, intermediate: 5, advanced: 6, completed: 7,
  };

  const { data: life } = await supabase
    .from("lives")
    .select("stage")
    .eq("id", lifeId)
    .single();

  if (!life) return;
  if (life.stage === "completed") return; // 수료는 건드리지 않음

  const currentPriority = STAGE_PRIORITY[life.stage] ?? 0;
  const newPriority = STAGE_PRIORITY[newStage] ?? 0;

  if (newPriority > currentPriority) {
    await supabase.from("lives").update({ stage: newStage }).eq("id", lifeId);
  }
}
