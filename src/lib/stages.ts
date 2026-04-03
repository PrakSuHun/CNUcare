export const STAGE_LABELS: Record<string, string> = {
  first_meeting: "1차 만남",
  pre_visit_connect: "전초연결",
  pre_visit: "전초",
  intro: "입문",
  beginner: "초급",
  intermediate: "중급",
  advanced: "고급",
  completed: "수료",
};

export const STAGE_COLORS: Record<string, string> = {
  first_meeting: "bg-red-100 text-red-700",
  pre_visit_connect: "bg-yellow-100 text-yellow-700",
  pre_visit: "bg-orange-100 text-orange-700",
  intro: "bg-amber-100 text-amber-700",
  beginner: "bg-yellow-100 text-yellow-700",
  intermediate: "bg-blue-100 text-blue-700",
  advanced: "bg-teal-100 text-teal-700",
  completed: "bg-green-100 text-green-700",
};

// 조직도에서 생명 이름 색상
export const STAGE_NAME_COLORS: Record<string, string> = {
  first_meeting: "text-red-600",
  pre_visit_connect: "text-yellow-600",
  // 나머지는 기본 검정 (빈 문자열)
};

export const STAGE_OPTIONS = [
  { value: "first_meeting", label: "1차 만남" },
  { value: "pre_visit_connect", label: "전초연결" },
  { value: "pre_visit", label: "전초" },
  { value: "intro", label: "입문" },
  { value: "beginner", label: "초급" },
  { value: "intermediate", label: "중급" },
  { value: "advanced", label: "고급" },
  { value: "completed", label: "수료" },
];

export const STAGE_ORDER: Record<string, number> = {
  completed: 0, advanced: 1, intermediate: 2, beginner: 3,
  intro: 4, pre_visit: 5, pre_visit_connect: 6, first_meeting: 7,
};

// 조직도용: 강의 전 단계 (이름 색상 강조 대상)
export function isPreLectureStage(stage: string): boolean {
  return stage === "first_meeting" || stage === "pre_visit_connect" || stage === "pre_visit";
}
