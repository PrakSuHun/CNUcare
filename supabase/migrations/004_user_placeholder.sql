-- 행사 상세에서 이름만으로 추가한 관리자(팀원)를 위한 placeholder 표식.
-- 강사(instructor_name 문자열)처럼 본인이 직접 가입하기 전까지는 백엔드 데이터로만 존재하고
-- 조직도에는 표시하지 않는다. 나중에 같은 이름으로 회원가입하면 이 레코드를 이어받아(claim) 연결된다.
alter table public.users
  add column if not exists is_placeholder boolean not null default false;

-- 이름으로 placeholder를 찾을 때 쓰는 인덱스
create index if not exists idx_users_placeholder_name
  on public.users (name) where is_placeholder = true;
