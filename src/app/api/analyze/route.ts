import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}


// 생명별 분석 데이터 수집
async function getLifeContext(lifeId: string) {
  const [life, journals, checks] = await Promise.all([
    getSb().from("lives").select("*").eq("id", lifeId).single(),
    getSb().from("journals").select("*, author:users(display_name)").eq("life_id", lifeId).is("deleted_at", null).order("met_date", { ascending: false }),
    getSb().from("lesson_checks").select("*, lesson:lessons(number, name)").eq("life_id", lifeId),
  ]);
  return { life: life.data, journals: journals.data || [], checks: checks.data || [] };
}

// 대학생별 분석 데이터 수집
async function getStudentContext(studentId: string) {
  const [student, userLives] = await Promise.all([
    getSb().from("users").select("*").eq("id", studentId).single(),
    getSb().from("user_lives").select("life_id").eq("user_id", studentId).eq("role_in_life", "evangelist"),
  ]);
  const lifeIds = (userLives.data || []).map((ul: any) => ul.life_id);
  const [lives, journals] = await Promise.all([
    getSb().from("lives").select("*").in("id", lifeIds),
    getSb().from("journals").select("*").in("life_id", lifeIds).is("deleted_at", null).order("met_date", { ascending: false }),
  ]);
  return { student: student.data, lives: lives.data || [], journals: journals.data || [] };
}

// 관리자 팀 분석 데이터 수집
async function getManagerContext(managerId: string) {
  const [manager, students] = await Promise.all([
    getSb().from("users").select("*").eq("id", managerId).single(),
    getSb().from("users").select("id, display_name").eq("manager_id", managerId).eq("role", "student"),
  ]);
  const studentIds = (students.data || []).map((s: any) => s.id);
  const [userLives, allJournals] = await Promise.all([
    getSb().from("user_lives").select("user_id, life_id").in("user_id", studentIds).eq("role_in_life", "evangelist"),
    getSb().from("journals").select("life_id, met_date, response, author_id").is("deleted_at", null).order("met_date", { ascending: false }).limit(200),
  ]);
  const lifeIds = (userLives.data || []).map((ul: any) => ul.life_id);
  const [lives] = await Promise.all([
    getSb().from("lives").select("*").in("id", lifeIds),
  ]);
  return {
    manager: manager.data,
    students: students.data || [],
    userLives: userLives.data || [],
    lives: lives.data || [],
    journals: allJournals.data?.filter((j: any) => lifeIds.includes(j.life_id)) || [],
  };
}

// 전체 분석 데이터 수집
async function getOverallContext() {
  const [lives, users, journals, checks] = await Promise.all([
    getSb().from("lives").select("id, name, stage, is_failed, last_met_at, created_at"),
    getSb().from("users").select("id, display_name, role, manager_id"),
    getSb().from("journals").select("life_id, met_date, purpose").is("deleted_at", null).order("met_date", { ascending: false }).limit(500),
    getSb().from("lesson_checks").select("life_id, lesson_id, is_passed"),
  ]);
  return { lives: lives.data || [], users: users.data || [], journals: journals.data || [], checks: checks.data || [] };
}

export async function POST(req: NextRequest) {
  try {
    const { type, targetId, targetName, createdBy } = await req.json();

    let prompt = "";
    let context: any = {};

    if (type === "life") {
      context = await getLifeContext(targetId);
      prompt = `당신은 교회 선교 활동 분석 전문가입니다.
아래는 "${context.life?.name}" 생명(선교 대상자)의 전체 데이터입니다.

[기본 정보]
${JSON.stringify(context.life, null, 2)}

[일지 기록 (최신순, ${context.journals.length}건)]
${context.journals.map((j: any) => `- ${j.met_date} | ${j.location || ''} | ${j.response || '(내용 없음)'} (작성: ${j.author?.display_name || ''})`).join("\n")}

[강의 진도 (${context.checks.length}강 완료)]
${context.checks.map((c: any) => `- ${c.lesson?.number}. ${c.lesson?.name} ${c.is_passed ? '(패스)' : ''}`).join("\n") || "아직 없음"}

다음 항목을 분석하여 마크다운 보고서를 작성해주세요:
1. **생명 현재 상태 요약** - 영적 상태, 전도 진행도
2. **최근 반응 동향** - 최근 일지 기반 긍정적/부정적 변화
3. **성격·소통 스타일** - 일지 내용에서 파악되는 성격
4. **관심사와 고민** - 생명이 관심 있는 것, 걱정하는 것
5. **주의사항** - 접근 시 조심해야 할 점
6. **다음 단계 제안** - 구체적인 행동 제안

한국어로 상세하게 작성해주세요.

중요: 결과를 아래 규칙에 따라 HTML 코드로 출력하세요. HTML만 출력하고 다른 텍스트는 넣지 마세요.
- 전체를 하나의 <div> 안에 담기
- 상단에 제목과 요약 카드 (배경색 있는 둥근 카드)
- 각 분석 항목은 흰 배경 카드로 구분
- 중요한 수치는 큰 글씨 + 색상 강조
- 긍정적 내용은 초록, 부정적/주의는 빨강/주황
- 리스트는 아이콘 또는 색상 불릿으로 시각화
- CSS는 인라인 스타일로 포함 (외부 CSS 없이)
- 폰트: system-ui, 둥근 모서리, 부드러운 그림자 사용
- 모바일 대응 (max-width: 100%)
- 마지막에 "AI 분석 보고서 · 생성일: 오늘 날짜" 푸터 포함`;

    } else if (type === "student") {
      context = await getStudentContext(targetId);
      const active = context.lives.filter((l: any) => !l.is_failed);
      const failed = context.lives.filter((l: any) => l.is_failed);
      prompt = `당신은 교회 선교 활동 분석 전문가입니다.
아래는 대학생 "${context.student?.display_name}"의 전도 활동 데이터입니다.

[대학생 정보]
${JSON.stringify(context.student, null, 2)}

[담당 생명 ${context.lives.length}명 (활성 ${active.length}명, 페일 ${failed.length}명)]
${context.lives.map((l: any) => `- ${l.name} | ${l.stage} | ${l.is_failed ? '페일' : '활성'} | 마지막만남: ${l.last_met_at || '없음'}`).join("\n")}

[일지 기록 (최신순, ${context.journals.length}건)]
${context.journals.slice(0, 50).map((j: any) => `- ${j.met_date} | ${j.response?.slice(0, 100) || '(내용 없음)'}`).join("\n")}

다음 항목을 분석하여 마크다운 보고서를 작성해주세요:
1. **전도 활동 요약** - 전체 현황, 성과
2. **전도 스타일 장점** - 잘하고 있는 것
3. **전도 스타일 단점** - 개선이 필요한 것
4. **페일 패턴 분석** - 어떤 상황에서 페일이 발생하는지
5. **잘 맞는 생명 유형** - 어떤 유형의 사람과 잘 소통하는지
6. **성장 포인트 제안** - 구체적인 개선 방안

한국어로 상세하게 작성해주세요.

중요: 결과를 아래 규칙에 따라 HTML 코드로 출력하세요. HTML만 출력하고 다른 텍스트는 넣지 마세요.
- 전체를 하나의 <div> 안에 담기
- 상단에 제목과 요약 카드 (배경색 있는 둥근 카드)
- 각 분석 항목은 흰 배경 카드로 구분
- 중요한 수치는 큰 글씨 + 색상 강조
- 긍정적 내용은 초록, 부정적/주의는 빨강/주황
- 리스트는 아이콘 또는 색상 불릿으로 시각화
- CSS는 인라인 스타일로 포함 (외부 CSS 없이)
- 폰트: system-ui, 둥근 모서리, 부드러운 그림자 사용
- 모바일 대응 (max-width: 100%)
- 마지막에 "AI 분석 보고서 · 생성일: 오늘 날짜" 푸터 포함`;

    } else if (type === "manager") {
      context = await getManagerContext(targetId);
      prompt = `당신은 교회 선교 활동 분석 전문가입니다.
아래는 관리자 "${context.manager?.display_name}" 팀의 전체 데이터입니다.

[관리자 정보]
${context.manager?.display_name}

[소속 대학생 ${context.students.length}명]
${context.students.map((s: any) => {
  const sLives = context.userLives.filter((ul: any) => ul.user_id === s.id).map((ul: any) => ul.life_id);
  const active = context.lives.filter((l: any) => sLives.includes(l.id) && !l.is_failed);
  const failed = context.lives.filter((l: any) => sLives.includes(l.id) && l.is_failed);
  return `- ${s.display_name}: 활성 ${active.length}명, 페일 ${failed.length}명`;
}).join("\n")}

[전체 생명 현황 (${context.lives.length}명)]
${context.lives.map((l: any) => `- ${l.name} | ${l.stage} | ${l.is_failed ? '페일' : '활성'}`).join("\n")}

[최근 일지 (${context.journals.length}건)]
${context.journals.slice(0, 30).map((j: any) => `- ${j.met_date} | ${j.response?.slice(0, 80) || '(내용 없음)'}`).join("\n")}

다음 항목을 분석하여 마크다운 보고서를 작성해주세요:
1. **팀 현황 요약** - 전체 성과, 활성/페일 비율
2. **대학생별 성과 비교** - 누가 잘하고, 누가 도움이 필요한지
3. **팀워크 분석** - 관리자와 대학생들의 협력 상태
4. **병목 구간** - 어디서 진행이 막히는지
5. **팀 강점과 약점**
6. **개선 제안** - 구체적인 전략

한국어로 상세하게 작성해주세요.

중요: 결과를 아래 규칙에 따라 HTML 코드로 출력하세요. HTML만 출력하고 다른 텍스트는 넣지 마세요.
- 전체를 하나의 <div> 안에 담기
- 상단에 제목과 요약 카드 (배경색 있는 둥근 카드)
- 각 분석 항목은 흰 배경 카드로 구분
- 중요한 수치는 큰 글씨 + 색상 강조
- 긍정적 내용은 초록, 부정적/주의는 빨강/주황
- 리스트는 아이콘 또는 색상 불릿으로 시각화
- CSS는 인라인 스타일로 포함 (외부 CSS 없이)
- 폰트: system-ui, 둥근 모서리, 부드러운 그림자 사용
- 모바일 대응 (max-width: 100%)
- 마지막에 "AI 분석 보고서 · 생성일: 오늘 날짜" 푸터 포함`;

    } else if (type === "overall") {
      context = await getOverallContext();
      const managers = context.users.filter((u: any) => u.role === "manager");
      const students = context.users.filter((u: any) => u.role === "student");
      const active = context.lives.filter((l: any) => !l.is_failed);
      const failed = context.lives.filter((l: any) => l.is_failed);
      const stages: Record<string, number> = {};
      active.forEach((l: any) => { stages[l.stage] = (stages[l.stage] || 0) + 1; });

      prompt = `당신은 교회 선교 활동 분석 전문가입니다.
아래는 전체 선교 조직의 데이터입니다.

[조직 규모]
관리자 ${managers.length}명, 대학생 ${students.length}명, 생명 ${context.lives.length}명 (활성 ${active.length}명, 페일 ${failed.length}명)

[단계별 현황]
${Object.entries(stages).map(([k, v]) => `- ${k}: ${v}명`).join("\n")}

[관리자별 현황]
${managers.map((m: any) => {
  const mStudents = students.filter((s: any) => s.manager_id === m.id);
  return `- ${m.display_name}: 대학생 ${mStudents.length}명`;
}).join("\n")}

[최근 일지 활동 (${context.journals.length}건)]
최근 7일: ${context.journals.filter((j: any) => {
  const d = new Date(j.met_date);
  return d > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
}).length}건
최근 30일: ${context.journals.filter((j: any) => {
  const d = new Date(j.met_date);
  return d > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}).length}건

[페일 비율]
${failed.length}/${context.lives.length} (${context.lives.length ? Math.round(failed.length / context.lives.length * 100) : 0}%)

다음 항목을 분석하여 마크다운 보고서를 작성해주세요:
1. **전체 현황 요약** - 조직 전체 상태
2. **단계별 병목 분석** - 어디서 정체가 심한지, 왜 그런지
3. **성공 패턴** - 수료까지 간 사례의 공통점
4. **실패 패턴** - 페일이 발생하는 주요 원인
5. **관리자별 성과** - 어느 팀이 잘하고 어디가 부족한지
6. **전략적 개선 제안** - 전도 효과를 높이기 위한 구체적 방안

한국어로 상세하게 작성해주세요.

중요: 결과를 아래 규칙에 따라 HTML 코드로 출력하세요. HTML만 출력하고 다른 텍스트는 넣지 마세요.
- 전체를 하나의 <div> 안에 담기
- 상단에 제목과 요약 카드 (배경색 있는 둥근 카드)
- 각 분석 항목은 흰 배경 카드로 구분
- 중요한 수치는 큰 글씨 + 색상 강조
- 긍정적 내용은 초록, 부정적/주의는 빨강/주황
- 리스트는 아이콘 또는 색상 불릿으로 시각화
- CSS는 인라인 스타일로 포함 (외부 CSS 없이)
- 폰트: system-ui, 둥근 모서리, 부드러운 그림자 사용
- 모바일 대응 (max-width: 100%)
- 마지막에 "AI 분석 보고서 · 생성일: 오늘 날짜" 푸터 포함`;
    } else {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    // 보고서를 "pending" 상태로 바로 저장
    const { data: report, error: insertError } = await getSb().from("reports").insert({
      type,
      target_id: targetId || null,
      target_name: targetName,
      content: "<div style=\"padding:24px;text-align:center;color:#6b7280\"><p>분석 중입니다...</p></div>",
      status: "pending",
      request_data: { prompt },
      created_by: createdBy || null,
    }).select("id").single();

    if (insertError) {
      console.error("Report insert error:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // 서버에 즉시 처리 요청 (fire-and-forget)
    const baseUrl = req.headers.get("host") || "localhost:3000";
    const protocol = baseUrl.includes("localhost") ? "http" : "https";
    fetch(`${protocol}://${baseUrl}/api/process-reports`).catch(() => {});

    return NextResponse.json({ id: report?.id, status: "pending" });
  } catch (err: any) {
    console.error("Analyze error:", err?.message);
    return NextResponse.json({ error: err?.message || "분석 요청에 실패했습니다." }, { status: 500 });
  }
}
