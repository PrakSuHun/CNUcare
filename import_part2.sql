DO $$ DECLARE life_id uuid; BEGIN

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('윤상이', '에너지 공학과', NULL, '논알콜파티', 0, NULL, '시험끝나고 만나기로', 'first_meeting', NULL, NULL, '25.0')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('정지율', '자율전공', NULL, '노방', 2, false, 'istp. 무교. 남친×친구×. 산림환경학과로(농대) 갈 예정. 산림청 가고 싶어함. 첫째(남동생). 영어스터디 동아리 들어감', 'first_meeting', NULL, NULL, '26.0')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('강민주', '수학과', NULL, '노방', 0, false, '과대, 학생회 생각있음 담주 화욜 과팅(물리학과)가는데 이상형 있어서 잘 안되게 기도 진로 고민 많이 하다가 rotc도 할려고함, 4/28일에 마감됨', 'first_meeting', NULL, NULL, '26.0')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('서예린', '무역학과', NULL, '러닝', 0, false, '경기도 군포 새터 안가서 친구가 없음, 이미 과친구들은 무리가 생긴것 같음 러닝, 영화동아리 들어감(영화동아리도 25,23밖에 없음) 러닝 고향에서 6개월간 함', 'first_meeting', NULL, NULL, '26.0')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('윤정원', '생물과학과', NULL, '네일', 0, false, '나이 많은 25(23살) 작년에 반수해서 1학년 2학기거를 듣고있음 나는 휴학 여러번 한 4학년?, 휴학때 이것저것 함. 강의와 선교사 준비 등 약간 많이 게으르고 게임 좋아하고,, 극 i 근데 생각이 조금 우울해진다고 해서 친구 만나야 될것같다고 말함 집에 매주 간다고(지금 장대동에서 자취) 외동,남친 생각 없고, 완전 집안이 무교', 'first_meeting', 23, NULL, '25(23)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('최서연', '기계공학과', NULL, '이맛저맛 특강', 0, false, NULL, 'first_meeting', NULL, NULL, '25.0')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('김가현', '식품공학과', NULL, '네일', 2, false, NULL, 'first_meeting', NULL, NULL, '24.0')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('강윤지', '공공안전융합학부', NULL, '논알콜파티', 3, false, '청주 / 2살차이 남동생 / ? / INTP / 청주에서 통학 중', 'first_meeting', 21, '1', '25(21)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('4ab96ec9-6bd6-42e2-be4c-75269d9c9037', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '4ab96ec9-6bd6-42e2-be4c-75269d9c9037', CURRENT_DATE, '(엑셀 데이터)', '0422) 5월 10일 연결 -> 과 mt 있어서 못감 0507) 치킨 기프티콘으로 만남 가능, 엠티 후 약속 잡지 않을까 0708) 현희랑 얘기해봐야될듯, 집에 갔는지 안갔는지 파악안된 상태, 연락 넣어보기,치킨 기프티콘 사용안함 0725) 현재 청주에 있음. 계속 약속 잡는 중(현희,보현 일정이 잘 안 맞아서) 대전으로 올 수 있다해서 만나긴할듯 0808) 개강 후 만나기로 0911) 19일 점심 만남 예정(현희,보현)-아고라 제안. 안될시 바로 927 / 호기심이 많은 편이라 귀신도 궁금해함 0925) 0925 아고라광장으로 만나기로 함 :: 자기 만들기 진행함, 다음 강의는 도파민 중독  1002) 오늘 만나서 아고라광장함, 추석 연휴 후 시간 맞춰보기로 / 3주된 남자친구 있다고함(동아리에서 만남), 28일 첫시험 과제 대체 강의 많아서 시간 좀 있는듯 1023) 이미 전초들은 유미와의 관계 파악해보고, 축제부스생명들 상황보고, 무리가 안되면 연습용으로 강의해보기  1106) 약속잡아보기  1111) 진행 없음. 빨리 약속 잡아보기. 선교사 전초 0107) 우리끼리 먹짱 하자. 나도 그날 시간이 안 되어서 아쉽더라. -> 헤어졌다고 하면 해볼만함. 안 헤어졌다고 하면 끝. 0114) 방학 때 청주에 있음. 현재 일본 여행 중. 오늘 저녁에 한국 돌아옴. / 일단 남자친구 먼저 물어보기. 0121) 남자친구랑 여행 다녀온건지?! -> 헤어졌다고 하면 만나보기... 0128) 27일에 연락 넣었는데 아직 답 없음. 0204) 남자친구랑 11월에 헤어졌다고 함. 2월 12,13중에 한 번 만나보기. 0211) 목금 보현 시간이 안 될 것 같음ㅜ 개강 전주나 첫주에 봐야할듯! 0225) 다음주 중으로 만나게 될듯. 0317) 약속 빨리 잡기!! -> 만나서 전초. 0325) 다음주에 또 만나보기. 안 되면 시험 후에 만나기.');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('김여은', '자연과학융합', NULL, '축제-이맛저맛 체험단', 0, NULL, '반석 쪽 교회다님(나름 열심히 다니는듯? 매주감. 친구따라 초등학생때부터 다님 (할머니 집 근처 다니다가 이사하고 안다니다 친구소개로 다시 다니다가 코로나때 안다니다 코로나끝나고 다시 다님), 수련회, 예배, 기도 해보면서 깨달아서 + 친한 친구랑 같이 다녀서 + 재미있어서 계속 다닌다고 함. 성경에 궁금한 거 없냐고 물었을 때 자기는 받아들이는 편이라고 함. 길에서 전도하는 거 싫다고 함(사람들 싫어하는데 왜 그렇게까지 하는지 모르겠다함) 모세의 기적 어떻게 생각하냐고 물어보니 밀물과 썰물같은 현상으로 일어난게 아닐까 추측중이라고 함. 신앙 고민 딱히 없는 것 같고, 성경 궁금한 건 찾아보고 교회 언니들한테 물어본다고 함. 초등학교 교사(애기들 찬양 도와줌) 그래서 예배 두 번 드림. 큐티는 매주 안 하고 하고 싶을 때 마음 맞는 사람이랑 같이 한다고.', 'first_meeting', 21, NULL, '25(21)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('4ab96ec9-6bd6-42e2-be4c-75269d9c9037', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '4ab96ec9-6bd6-42e2-be4c-75269d9c9037', CURRENT_DATE, '(엑셀 데이터)', '0107) 동전계시. 연락해보기. 교회 얼마나 다니는지 (주일예배 정도 ok. 청년부예배까지 + 청년부 활동 많으면 위험함. 관리해주는 사람이 있는지(인간관계) 등 파악해보기. 보현 컨셉 : 신앙 좋은 기성. 제주도에서 교회 다니고 거기 아는 분이 소개해준 사람과 큐티 정도. 신앙 고민이 있을 때 찾아갈만하지만 부담스럽지는 않은 사람으로.. / 구장,단장,교역자 표현 X, 회장 O 제안 : 반석동 예카에서 같이 큐티할래? / 파악 : 신앙 고민이 있는지, 좋아하는 성경 인물, 좋아하는 성경구절, 연애할 때 기독교인이 좋은지. 취직하려고 하는데 하나님 뜻인지 아닌지 모르겠다 등.) 0114) 지금 디엠 보냄 0121) 29일 점심에 반석에서 만나기로 함. 0204) 밥먹고 카페가면서 더 얘기하려고 했는데, 이후 일정 있어서 밥만 먹고 헤어짐. >> 설희언니한테 물어보기 0211) 같이 큐티해보고 반응 보고 결정해야할듯? 교회생활에 만족하고 있어서 최우선 순위는 아닐듯. 벧물 얘기하면서 우리 목사님한테 최근에 배웠는데 너무 재밌어서 나누고 싶었다. 낌새가 안 좋으면 바로 바이. 오 되게신기하다 재밌다~! 다음에 또 하자 or 성경을 잘 아는 게 중요하더라. 기적으로만 보면 일상에서 안 일어나지 않냐. 교회 청년부들한테는 부끄러워서 그런데, 애들 가르치는 거 들어줄 수 있냐. 0225) 연락 아직 못함. 0317) 빨리 약속 잡기!!');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('정다빈', '신소재공학과', NULL, '축제-책부스', 0, false, '- 대전(월평) 주짓수 isfp - 계절학기 신청 예정 - 원서 잘 읽음, 책 읽으려고 노력 - 남친/종교/인간관계 파악x - 모태신앙, 새로남 교회, 매주 예배 나가고, 외가친가 다 새로남교회, 부모님 교회에서 반주하심. 어렸을 때 바이올린 했었다고 함. 새로남 교회 가면 충대생들 많다고 함. 선후배 밥사달라고 한다고.', 'first_meeting', 20, '1', '25(20)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('4ab96ec9-6bd6-42e2-be4c-75269d9c9037', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '4ab96ec9-6bd6-42e2-be4c-75269d9c9037', CURRENT_DATE, '(엑셀 데이터)', '1106) 독립서점가는거 답없는 생명 뺴고 단톡 다시 만들어서 빠르게 진행 1111) 진행 상황 없음, 과제 도와달라고 해서 도와줌. 독립서점 다시 제안하기.  11/19톡으로타로제안하기 1203) 타로 약속 잡고 있는 중.  0107) 정다빈과 김성민이랑 같이 나와서 수빛, 보현, 다빈, 성민 만나서 타로봐줌.  다빈, 성민 둘 중 어떤 애가 택자인지 계시 받아보기. 타로 이후에 결과 어떻게 됐는지 물어보기. 0114) 타로 봤던 남자랑은 안 사귀는 중.  0120) 성민이한테 베이킹 제안했을 때 다빈이 같이 가도 되냐고 물어봤음. 대전에 있는 다빈이 먼저 지수,보현이 같이 만나보기로. 0121) 연락 타이밍? 지수가 단톡에 독립서점 한 번 더 가자고 하기. 가능하면 다음주 안으로. 만나서 종교파악 위주로 대화. 0128) 지수, 보현 30일 2시 반에 독립서점 가기로 함 : 종교 / 인간관계 파악?(대화를 나눌 수 있는 곳이면 좋을듯) 0204) 지수(선데이크리스천, 집근처교회) 보현(기독교, 교회 안 밝힘) 컨셉으로 종교파악함. 성민이한테 베이킹 제안했던거 본인도 관심있어함.: 성민이 먼저?');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('김성민', '신소재공학과', NULL, NULL, 0, false, NULL, 'first_meeting', 20, '1', '25(20)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('4ab96ec9-6bd6-42e2-be4c-75269d9c9037', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '4ab96ec9-6bd6-42e2-be4c-75269d9c9037', CURRENT_DATE, '(엑셀 데이터)', '다빈이 따라 타로보러 나옴. 수빛이가 나중에 셋(성민 우인 보현) 같이 베이킹 하자고 하면서 연락처 교환했음 0114) 가위바위보로 성민이 먼저?! 연락해보기...(수빛) 0121) 베이킹 약속 잡는 카톡 마무리 짓기(수빛) 0204) 베이킹 다시 잡기? 0211) 수빛 약속 잡고. 넷이 만나서 뭐라도 따로 빼는 방법 연구하기. 0317) 다빈+성민 같이 나올 것 같은데, 우선순위는 아닌 것 같음. -> 다른 생명들 먼저 하기.');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('이예후', '경제학과', NULL, '베이킹', 0, false, '본가 청주, 대전 손짜장 쪽에서 자취 ISFP. 할아버지가 스님이셔서 불교였으나, 현재는 무교. 23학번 철학과 입학했다가(암기과목 잘했어서, 윤사 좋아했음, 근데 막상 가보니까 팀플도 많고 학과 내용이랑 잘 안 맞았음) 24경제로 들어옴 엠티 한 번 가고 과생활 안 함 3학년 끝나고 1년 휴학 예정(쉬고싶다 함) 친한 사람 별로 없는듯 아는 언니 생겨서 좋아함 시험 후가 좋다고 해서 시험끝나고 보기로함 중학교 이후로 남자친구 사귄적 없음. 부모님은 전문직(사자직업) 하길 원하는데 본인은 다른 길 가고 싶음(제빵 관심) 그래서 원하는 길 가려면 부모님이랑 싸워야한다 함. 경제랑 잘 안 맞는다 함(베이킹 온 날도 수업 두개 자체휴강). 다음 베이킹도 참여하고 싶어함. 손으로 하는 거 좋아함(네일도 본인이 직접)  3살 차이 남동생 6살차이 여동생 남동생이랑 좀 더 친함  왕할아버지가 스님이셨음 중학생때까지 가족 다같이 절 다님 할아버지 돌아가신 후엔 안 감 그래서 주변에서 종교 물어보면 불교라 하다가 지금은 무교라 한다고 함 크리스마스 때 친구따라 교회 가봄(중학생때, 부모님 종교에 관대하심) 매주 나가는 게 힘들어서 자기는 못 다닐 것 같다 함 매주 나가는 게 신기하다고. 사주, 타로 본 적 있음 -> 다음에 타로 봐준다 함 -> 보현 집근처 교회 다니는 거 밝힘 애들 가르친다고도 얘기해둠  교회는 3~4번 가봤음. 다 친구 따라 행사 가본 것. 주변에 기성 친구들 많음 (교회다니는 친구 많다고 함. 그 중에서 경제학과 학생회하려고 하는 예후 친구가 교회에서 교사 역할하는 듯) 어머니가 2~3년 정도 종교를 찾으시다가 천주교 세례를 받았었는데, 더 나가지는 않는다고 함. 내가 뭘 좋아하는지 잘하는지 찾고 싶어함. 진로 고민을 많이 하고 있고, 미래가 궁금해서 사주 보고 싶어하는 상황. 방학 때 시간 많은 상황.', 'first_meeting', 22, '2', '24(22)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('4ab96ec9-6bd6-42e2-be4c-75269d9c9037', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '4ab96ec9-6bd6-42e2-be4c-75269d9c9037', CURRENT_DATE, '(엑셀 데이터)', '1126) 타로 해주겠다고 했음.  1203) 시험 때문에 그 후에 보자고 했음. 0107) 연락해보기(청주연결도 고려해보기. ex. 친구만나러 청주가는데 만나자 하면서 청주교회 사람 연결) 0114) 계절학기로 대전에 있었음...! 디엠 중인데 안부 물은 거에 답이 없음. 0121) 28일 점심에 보기로 함 : 상황 봐서 전초 던져보기(피드백 해달라고) 안 되면 베이킹이나 타로 던져 놓기. -> 초등학생도 코딩 배우는 시대. 학교 강사 나가서 잘 아는 컨셉으로 전초를 해보면 어떨지? 0204) 전초 성공해서 다음주에 시간 잡아보기로 함. 예후 만나러 갈 때 0316 + 119차량 계시 둘 다 받음. (예후 같은 과 친구 중에 기성(교사)인 애랑 가깝고 주변에 기성 친구들 많아서 조심해야할 듯. 말씀 공유할수도.) 베이킹에 관심 있어서 다음에 아는 언니랑 할 때 불러주겠다고 제안함 + 타로 봐달라고 함. 토요일에 보기로. 첫 강의 듣고 입막음 해야할듯. 0211) 2/9 썬스탑 강의함. 성경이 재미있다고. 호기심 많은 편인듯 이것저것 성경에 대해서 물어봄. 설연휴 이후에 볼듯. 다음시간에 입막음!! 0225) 아직 본가에 있어서 개강 후에 볼듯. 0317) 316에 윤아 만남. 친해지는 시간. 이번주부터 윤아언니한테 강의 듣자고 하기. -> 할지 말지 고민중. 예후 육적인편이라 -> 보현 2~3개 강의 해보고 계시 받아보기 0325) 이번주 혹은 다음주 중으로 약속.');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('조경빈', '수학과', NULL, 'ai특강', 0, false, 'INFJ 암호학에 관심있어서 (셜록/이미테이션게임 보고 흥미) 컴공이랑 수학과 지원함 충대가 1순위였음 수학과외 / 통기타 독학 중(3개월) 장녀 남동생 두명(2살/6살차이) 이성 없음(자만추 추구 / 과팅 관심 없음) 되게 바른 느낌', 'first_meeting', NULL, '1', NULL)
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('4ab96ec9-6bd6-42e2-be4c-75269d9c9037', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '4ab96ec9-6bd6-42e2-be4c-75269d9c9037', CURRENT_DATE, '(엑셀 데이터)', 'ai특강 후 저녁 같이 먹음. 개강 후에 또 보기로 함 0317) 만나서 파악 더 해보고, 전초거리 생각 안나면 피드백 해달라고 하기. 0325) 이번주 금 약속');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('성은총', '농생명융합학부', NULL, '행티 노방', 0, false, NULL, 'first_meeting', 20, '1', '26(20)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('4ab96ec9-6bd6-42e2-be4c-75269d9c9037', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '4ab96ec9-6bd6-42e2-be4c-75269d9c9037', CURRENT_DATE, '(엑셀 데이터)', '0317) 318에 벧물 첫강의, 설희언니 소개. 0318) 벧물 강의함. 말씀 잘 들음. 꽤 집중해서 듣는 편. 벧물 비유 뭐일 것 같냐고 물었을 때 전도하라는 말인 것 같다고 함. 또 들어볼 생각 있냐고 물었을 때 이렇게 풀어주는 거면 좋다고 함.  나도 배우는 입장이라 아는 언니랑 같이 듣자고 했음. 오케이함. 모쏠, 귀찮기도 하고 아직 연애 생각 없음');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('손한별', NULL, NULL, '클린어쓰', 0, NULL, NULL, 'first_meeting', NULL, NULL, NULL)
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('4ab96ec9-6bd6-42e2-be4c-75269d9c9037', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '4ab96ec9-6bd6-42e2-be4c-75269d9c9037', CURRENT_DATE, '(엑셀 데이터)', '0325) 오늘 9시 스타트업파크에서 설희보현한별 만나기로 함. 만나서 파악 가능하면 전초');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('김시영', '통계학과', NULL, '축제-책부스', 0, false, '본가 서울. 1학년때는 서울에서 통학. 지금은 죽동 쉐어하우스. 언니들과 잘 맞음. 중앙동아리 교양독서회(?) 하고 있음. 실제 책읽는 것 좋아함.  야구 엄청 좋아함(한화팬). 농구, 축구도 봄 ISFP. 근데 전공따라서 T되고 있다고 함. 중학교까지 무용을 했었음. 전공:발레, 부전공:한국무용. 근데 아프기도 하고, 가정의 경제 생각, 특출나진 않으니 그만두고 공부. 중학교 졸업할 때 2등으로 졸업. 쎼한 사람은 아예 멀리함. 그래서 과에서 2~3명 소수로 다님. 혼밥도 잘함', 'first_meeting', 21, '2', '25(21)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('fac56830-746d-4e52-800d-917483780896', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, 'fac56830-746d-4e52-800d-917483780896', CURRENT_DATE, '(엑셀 데이터)', '1205) 사진모델 제안했더니 좋아함. 시험기간도 괜찮고, 방학 때도 대전 자주 와서 괜찮다고 함 0309) 3/10에 점심 같이 먹고 상미 카페에서 만나서 사진 컨셉 대화하며 더 파악. 사진 촬영은 3/22 0330) 3/22에 전초함. 4/1 첫강의');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('임서영', '화학과', NULL, '기자단', 0, false, '고향 칠곡/ K장녀/ 태권도4품 엄마가 일욜 아침에 동생이랑 둘이 교회 가게 함. 3년 다님. 지금은 무교. 종교에 대한 인식은 딱히 없음 열심히 삶. 방학 때 근로, 알바. 중국어, 일본어 공부중, 조향사가 꿈. 인생 고민(어떻게 살아야 하는지, 내가 직접 경험하면서 하나하나 찾아가고 싶은 마음) ISFJ에서 INTJ로 바뀜-어떤 일을 겪음(부모님이 초4때 이혼) 집순이/ 영화, 드라마, 책. 교보문고 가는 거 좋아함. 새책냄새/ 작은 빵집 찾아보는 거 좋아함', 'first_meeting', 21, '2', '25(21)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('fac56830-746d-4e52-800d-917483780896', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, 'fac56830-746d-4e52-800d-917483780896', CURRENT_DATE, '(엑셀 데이터)', '0120) 일요일에 같이 베이킹도 함. 월든책으로 독서모임하고싶다고 함 / 행충 의논 후에 결정해보기. - 설희 독서 모임 해보기, 일요일 세종 5시 마지노선. 0121) 1/25 5시로 북토크 잡아보기. 월든 원하는 파트 1개 이상 읽어오기/ 일욜 어렵다고 해서 밀림 0204) 2/1 북토크 진행함. 북토크 형식으로 성경 강의 7-8개 들어보기로.');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('임수아', '의류학과', NULL, '클린어스', 0, false, 'infp/ 생과대 학생회 사무부/ 고향 용인/ 방학 때 긱사 남아있을 것/ 어머니랑 톡, 통화 자주/ 동아리는 안함/ 여동생 1명있음/ 산학연에서 토익수업 들음/  큰 고민 없음/ 제베원 김지웅 매우 좋아함/ 무교. 가족도. 그러나 아버지가 무당한테 가서 굿한 적 있음', 'first_meeting', 20, '1', '26(20)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('fac56830-746d-4e52-800d-917483780896', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, 'fac56830-746d-4e52-800d-917483780896', CURRENT_DATE, '(엑셀 데이터)', '3/17 인터뷰 3/24 2차만남 3/31 3차만남. 길에서 말 걸린 적이 많음. 친구들하고도 얘기. 친구는 즐기며 영상찍는다고 함. 인생에 대한 생각 깊지 않음. 전초 보류 우선 4/11 일반단체 특강에 초대해서 일반단체에 넣어놓기? 아니면 5월에 전초하던지');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('송민아', '간호학과', NULL, '기자단', 0, NULL, NULL, 'first_meeting', NULL, '4', NULL)
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('fac56830-746d-4e52-800d-917483780896', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, 'fac56830-746d-4e52-800d-917483780896', CURRENT_DATE, '(엑셀 데이터)', '1/7 만남');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('김예은', '경영학과', NULL, '클린어스', 0, false, 'infj. 교회', 'first_meeting', 21, '2', '25(21)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('fac56830-746d-4e52-800d-917483780896', life_id, 'evangelist') ON CONFLICT DO NOTHING;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('김보미', '창의융합', NULL, '네일', 1, false, 'ISTP/대학교와서 대학생활이 그다지 재미있지 않다고 느낌, 인간관계도 자기와 깊이 통하고 친한 친구도 없다고 이야기/긱사에 살다가 시험기간중에 충대 근처로 자취할 예정. 이미 자취방 구했고 6/14 입주 예정이라고 함.  방학 때 만나서 친해지다가 전초하면 될 것 같음.', 'first_meeting', 20, NULL, '25(20)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('박인영', '언론정보', NULL, '논알콜파티', 0, false, NULL, 'pre_visit', 22, NULL, '23(22)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('박예빈', '식품공학과', NULL, '맛동산', 5, false, 'ISFP / 전북 익산 / 오빠 1명 / 모태 신앙. 대형 교회. 어머니가 목장, 권사님. 예빈이는 형식적으로 다니고 있는 / 기숙사', 'intro', 22, '3', '23(22)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('이나원', '국어교육과', NULL, '축제-이맛저맛 체험단', 1, false, '본가 전남 목포 / 한달~두달에 한번 집감 / 24학점 들음 / 증산도한테 카페사줌', 'first_meeting', 21, '2', '24(21)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('정지우', '영어영문', NULL, '맛동산', 0, false, '본가가 기억이 안남/ 동아리도 계속 나왔던 애/ 기숙사 살아서 고향이 대전이 아니었던듯', 'first_meeting', 24, '2', '24(24)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('박소연', '식품영양', 'ISF,,', '먹깨비', 0, NULL, '구미/무교/자취', 'first_meeting', 21, '2', '25(21)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('양소정', NULL, NULL, '베이킹', 0, true, NULL, 'first_meeting', NULL, NULL, '-21.0')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('박근영', '정치외교학과', NULL, '러닝', 0, true, '고딩때부터 사귄 남친', 'first_meeting', 20, '1', '25(20)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('김가현', '식품영양', NULL, '네일', 1, NULL, '셤기간 만나기 부담스러워 해서 개강하고 보자고 약속 한 상황. 방학때 연락해볼 예정', 'first_meeting', NULL, NULL, '24.0')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('정서인', NULL, NULL, '행티부스', 0, NULL, NULL, 'first_meeting', NULL, NULL, '26.0')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('임지민', '전기과', 'ESTJ', '이맛저맛 체험단', 0, NULL, 'ESTJ , 본가 광주(자취), 세살차이 오빠, 동아리 안함(축구 관심있어함), 알바해서 본가 잘 못 가는데 부모님이 오심 죽동 양식집에서 알바, 남자친구 X, 사귈 생각 딱히 없음', 'first_meeting', 20, NULL, '25(20)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('유채연', '간호학과', NULL, '먹짱', 0, NULL, '이제 연락. 보화 바쁨. 우선 현희 혼자', 'first_meeting', NULL, '2', '25.0')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('박현비', '소비자학과', NULL, '먹짱', 0, NULL, '정말 이상한 사람(웹툰같은 그림 그리는데 자해같은 내용, 암흑적인 내용', 'first_meeting', 20, NULL, '26(20)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('6aa67ffe-5c11-4e09-8336-6e9761800fd8', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '6aa67ffe-5c11-4e09-8336-6e9761800fd8', CURRENT_DATE, '(엑셀 데이터)', '0120) 걸러야할듯.');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('서채영', '경영학과', NULL, '교양', 2, false, 'isfj (점점 t가 되고 있다) / 서구 거주, 통학 / 3살 차이 오빠 있음 / 무교 / 친구가 많이 없다. 대신 과에 고3 후반 때부터 친한 친구가 있어서 걔랑 시간표 다 맞추고 거의 같이 있는다.  원래 알던 애들도 몇 있다. / 생각이 많지 않다. S 강한 듯 (성격고민 파악 못했다..) 깊게친한몇명 있음 엄청s인것같음 취미는 로맨스드라마 보기 대전 토박이라 학교까지 10분거리 3살차이 오빠있음 오빠도 충대 사후세계랑 귀신 그런쪽으로 깊이 생각안해보고 판타지 요소 그러려니 하는쪽 / 어려움이 큰 애는 아니어서 /  가족이랑 저녁을 먹으면서 많은 이야기를 함 / 일양골 사람 많아서 부담이라고 함.', 'first_meeting', 21, NULL, '25(21)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('6aa67ffe-5c11-4e09-8336-6e9761800fd8', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '6aa67ffe-5c11-4e09-8336-6e9761800fd8', CURRENT_DATE, '(엑셀 데이터)', '1104) 경영학과 졸업하고 강사로 뛰는 언니/ 수빛 연결해보기 1125) 금요일에 만나서 친해지는 시간-어떻게 알게된 사이냐고 해서 교회언니라고-시험끝나고 만나자-방학때 예은이랑 책 읽으라고 한 상황 0106) 수빛예은 셋이 만나서 전초. 북토크를 성경모임으로 이어나가보기 0114) 2/3에 수빛이랑 같이 만나기로 : 독서모임 제안할 예정, 근데 생명이 책 읽는 거 별로 안 좋아하는 건지, 그냥 안 읽는건지 잘 모르겠음. 0211) 오늘 만나기로 함. 지난번 만났을 때 독서모임+진로특강 얘기했고, 이번에 할듯. 도파민 중독, 자존감 물어봤을 때 거절 잘 못하고 자존감 낮다고 말함. 0306) 25일에 만나고 3일에 만남. 자존감 특강 3회함. 다음주에 수빛 전초 생각 중. 0311) 금요일에 수빛 만날 예정. 착한 애라서 전초하면 두 번은 들어줄 것 같음. 두 번 들으면 바로 윤아 연결');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('김희정', '(생명쪽 공대라 했으나 공대에는 생명X, 농대이지 않을까)', NULL, '기자단 노방', 0, false, '대전인데 학교랑은 좀 거리 있음 (녹음본 확인필요) / 옛날에 기독교 10년 / 자기 주관, 블로그 운영, 일기 매일 씀 / 팝업이랑 학원 알바 2개', 'first_meeting', 22, NULL, '24(22)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('6aa67ffe-5c11-4e09-8336-6e9761800fd8', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '6aa67ffe-5c11-4e09-8336-6e9761800fd8', CURRENT_DATE, '(엑셀 데이터)', '0105) 둘이서 인터뷰로 만나 3시간 이야기. 깊은 대화, 고민, 인생 걱정 얘기함. -> 열심히 경험하다 보면 왜 이렇게 살아야하는지 모르겠다. 인생 자체가 허무하다. 경험 좋아하며 다양한 의견 듣는 걸 좋아해서, 한 달에 두 번씩 만나 주제 정해서 토의하기로 함. 날짜는 아직 안 정함. 0106) 녹음본을 한번 같이 들어보기 0114) 고정 토의 날짜를 잡고, 그전까지 녹음본 듣기. 사회이슈로 파악해보고 별로면 방학 후에는 파하자고 하기. 0120) 2/3 만남 전까지 행복한 충청만들기 해결, 주제도 잘 정해야할듯 0127) 2/3에 만나기로.-> 행충 해결되어야 혹시 말 나왔을 때 예은이가 대처 가능할듯. 0203) 원래 오늘 만나기로 했는데, 독감걸려서 못 만날 것 같다고 연락옴. 날짜 다시 잡아야할듯. 0306) 2월 20일에 만났음. 예은이가 성경 전초 해서 다른 언니한테 들어보자고 했는데, 안 듣겠다고 함.  강의라는 단어에 부정적으로 반응함. 후순위로 놔야할듯');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('김시현', '자율선박? 공대', 'ENTP', '기자단 노방', 0, true, '전라도 여수/오빠 있음/모름/ENTP/살짝 우유부단?/끌 거리: 연극뮤지컬스탠딩코미디(현장감 생동감, 직접 체험 좋아함. 또 그렇게 막 좋아하지는 않음) 부산 등 타지역 놀러가기•전시나 팝업(가나디 X, 전독시 좋아함. 전시 자체는 안 즐기는데, 혼자 전시 투어 다니는 그 재미로 감.) 서울 옷 보러•수영(배우고 싶지만 같이 하기는 좀 그렇다고 함)/ 특이점: 그 얘기가 두루뭉술하게 끝나면 다시 돌아와서 정확하게 물어봄 & 억지반응 안 함 ''아 그렇구나.''하고 또 다른 얘기함.', 'first_meeting', NULL, '3학년', '22살')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('6aa67ffe-5c11-4e09-8336-6e9761800fd8', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '6aa67ffe-5c11-4e09-8336-6e9761800fd8', CURRENT_DATE, '(엑셀 데이터)', '0114) 사적으로 만나기로 얘기됨. 끌만한 아이템이 없었음. 타로 한 번 봐달라고 하기. 0120) 아직 만남 날짜 안 잡았지만, 1월에 만나자고 한 상황.  0127) 여수간 듯. 개강 후에 봐야 함. 0306) 16일에 보기로 함. 파악하는 날로 잡아야할듯 0311) 6일날과 동일. 4학년이니까 진로로 언니 소개시켜주면 어떨지. 우선 진로쪽 파악해보기.');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('박선주', '심리학과', NULL, '과 친구', 0, false, '다른 친구들이랑 타인 얘기 많이 함 (쟤도 뭐 그랬던데~) / 다영이랑 친구라서 다영이 먼저해야될듯 (셋이 밥먹자고 다영이가 말할정도로 같이 친구임)', 'first_meeting', 21, NULL, '25(21)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('6aa67ffe-5c11-4e09-8336-6e9761800fd8', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '6aa67ffe-5c11-4e09-8336-6e9761800fd8', CURRENT_DATE, '(엑셀 데이터)', '크리스마스때 당기려고했다가 팅겨진 애(갑자기 본가간다고)-말을쉽게하는스타일인가 /');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('김민주', '영어영문학과', NULL, '25년 1,2학기 교양', 0, NULL, '부모님이 대안학교 / 그래서 한살어림 / ESFP. S빼고 다 높은 편 2. 기독교래. 부모님이 운영?하시는 기독교대한학교 나왔다고 함. 3. 07이 자기밖에 없고 대한학교(엄청 빡셈. 단발 규정 + 인터넷 금지 + ..)라 사람 적어서 06 6명이랑 쭉 같은 반이었음. 과 친구도 이렇게 같이 나와서 놀러다닐 정도로 친하진 않다고 함.  4. 인생의 고민이나 관심사는 모르겠음. 5. 전남친이 같은 대한학교 나온 24살인데 수능 끝나고 사귀어서 6개월쯤 됐다 했으니까 사실상 18살이랑 23살이 만난 거임.  그놈이 이상한 거 같은데 얘가 그 사람을 얼마나 좋아하는지나 왜 좋아하는지 이유는 잘 모르겠음.  부모님은 다 아신다고 함. 남친 중학교 때 사진은 있다고 보여줬는데 영 아님.  남친 뭐 잘못해서 헤어짐. 좀 됨. 본인이 참.  게임,책,판타지물 좋아함   교회 주일에 잘 다님. 청년부 예배 드리고. 나 4번씩 예배 드려. 주일에 제일 바쁘고 넘 힘들어. 찬양팀 해서 토욜 리허설에 주일 아침 리허설.. 평소에 집에서 웹툰보고 게임하고 가끔 책 읽고 그래. (게임 발로란트였나 그걸 진짜 잘함. 폰이 수능 끝나고 생겼는데 그쯤부터 게임 했이니 11개월 정도만에 마스터 급 찍음 - 진짜 개개개잘하는 것임) 예카 가자고 해둠. 세정이 넘 좋아해서 같이도 한 번 가야될듯? 집은 대전이고, 겨울방학에 과사에서 계속 근로해서 학교 옴. 월화수목 올 거 같은데 시간은 자기가 정하기 나름이라 (나중에 만날 시간 맞추는 겸 자세히 물어봐야 할 듯)', 'first_meeting', 20, NULL, '25(20)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('6aa67ffe-5c11-4e09-8336-6e9761800fd8', life_id, 'evangelist') ON CONFLICT DO NOTHING;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('김서희', '식품영양학과', NULL, '독서노방', 0, false, '생각이 많은 타입, 짝사랑하는 오빠가 자기친구 좋아함, 자기주관 셈, 어릴때 왕따당한경험, 셋째딸, F강함, 하나님께 의지하는게 싫다', 'intro', 20, '1', '25(20)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('fac56830-746d-4e52-800d-917483780896', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, 'fac56830-746d-4e52-800d-917483780896', CURRENT_DATE, '(엑셀 데이터)', '0411 영혼육/ 0509 벧물/ 0523 썬스탑/ 0604 홍심 1002) 10월 말(시험후)에 볼 것 같음  0302) 덕대로 편입');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('이채우', '정보통계학과', NULL, '행티부스', 0, false, '둘째(첫째언니, 셋째남동생)/ 통학/ ENFJ', 'first_meeting', 20, '1', '26(20)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('fac56830-746d-4e52-800d-917483780896', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, 'fac56830-746d-4e52-800d-917483780896', CURRENT_DATE, '(엑셀 데이터)', '0310) 다음에 같이 최진엽샤브 가기로 함');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('이윤서', '영어영문학과', NULL, '대둔산서포터즈', 1, true, 'istj. 본가 천안. 현재 기숙사 6동 거주 요리동아리 남자친구 있음. 200일 됨. 1달 전 군대감. 남친 entp. 잘 맞진 않는다고 함/ 영화동아리 유미와 같은 조여서 알고 있음. 인스타 교환하며 알게 됨,,', 'first_meeting', 21, '2', '24(21)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('fac56830-746d-4e52-800d-917483780896', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, 'fac56830-746d-4e52-800d-917483780896', CURRENT_DATE, '(엑셀 데이터)', '512) 지민이 데려온 생명과 요리동아리여서 앎. 인사함. 그 생명 먼저 전초하기 그리고 유미랑 같은 영화 동아리');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('조현서', '농생명융합학부', NULL, '행티 부스', 2, false, '상주. ISFP, 기숙사, 무교, 외동, 부모님이랑 연락 자주 안함, 모쏠 연애하고 싶은 마음은 없음. 모난데 없이 순수함. 소크라테스도 관심있어 함. 고모가 학교근처에 사셔서 잘 챙겨주심.', 'first_meeting', 20, '1', '26(20)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('신수정', '문과 자유전공', NULL, '축제-이맛저맛 체험단', 3, NULL, 'INFP, 궁동에서 자취, 청주본가, 방학때 일주일씩 본가 자취방 왔다갔다한다고함, 천식이 있음, 3자매 중 맏이, 너무 착함, 남친은 공대,', 'first_meeting', 22, '2', '25(22)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('오나은', '농생명융합학부', 'ISTP', '블로그 소모임', 2, NULL, '경기도 안산이 본가,istp(완전 파워s),무교,술마심,하숙집에서 자취중(궁동),학부여서 2학년때 학과 선택(그게 젤 고민거리), 전에 악기도 했었어서 악기에도 예체능에도 관심 있음,대전투어 하고싶어함  순수하게 말씀을 들음, 신이 있을 것 같고 하나님얘기를 해도 거부감 없음. 대전에 아마 하숙집연장? 가능할수도  방학. 노는 시간이 아니다. 한달 놀면 충분', 'intro', 21, '2', '25(21)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('675f81f5-f643-4e26-9cb5-9eb98e36a8d2', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '675f81f5-f643-4e26-9cb5-9eb98e36a8d2', CURRENT_DATE, '(엑셀 데이터)', '0422) 4/17 목에 2번째 만남. 수빛 연결 생각중, 시험끝나고 놀러갈 때 연결? 0507) 대둔산 서포터즈 가자고 지수가 갠톡함, 그 담주 시험 있어서 어렵다 함  0520 벧물/ 0527 홍심/ 0603 썬스탑/ 0610 영혼육 0609) 방학 때 고향 감,, ㅠ 2주 쉬고 오도록 지수가 설득-컨텐츠,생활메이트 0610) 방학 후 한주 쉬고 7월에 줌 독서모임 제안해보기. 줌독서모임하면서 파악. 줌으로 강의 들을 수 있는 상황인지, 대전 오도록 0711) 0708에 줌 독서모임 진행함. 대전 오고 싶어함. 학교 근처 알바 구하는 중. 3개 정도 넣었는데 아직 안 됨. 담주 일본여행. 8월엔 올듯! 0715) 오늘 중으로 연락해서 상황 알아볼 예정 0718) 다음주 월요일에 줌으로 독서모임 0801) 일반말씀, 성경 말씀 짧게라도? 모세10개 재앙, 다윗, 사브앗과부 0813) 지수나은 만남. 2학기때 말씀 이어서 듣기로 함. 0904) 강의 다시 듣기로 함 1002) 화요일에 7단계 법칙 들었고 반응 나쁘지 않음, 연휴 후 잡아보고 안잡히면 시험 후에 볼 것 같음  1023) 입문 끝나고 신앙적으로 더 들어가야함. 시험 언제끝나는지 파악중  1120) 잘 듣고 있는데 방학때 집에 또 감 - 줌강의 도전  1126) 빛명이한테 강의 연결 => 질문폭격기 살짝 부담된것 같기도 1204) 이번에는 수빛 강의 0106) 대전에 있을 수 있게 알바 추천했는데 본가 감(어머니가 오라고 하신 것이 아닐까 추측). 1월 초에 오면 꼭 연락하라는 말 해놓음. 0113) 1월 초에 이미 왔다감,, 1월 안으로 수빛지수 경기도 출장! 목적 : 1순위 2월에 대전 올 수 있게 만들기 2순위 줌으로 일반말씀 강의 0120) 22일 안산 갈 예정 : 대전 올 수 있게 하는 아이템이 어떤 게 있을지? 대전 와서 갓생 살자. 갓생 설교. 생활스터디 농생융 결과 나왔을 것 0127) 수원 다녀옴. 카페에서 이야기하면서 대전 올 수 있는 방법을 물어봄.-> 해외여행도 가고 하숙집 계약 기간으로 올 수 없음. 대신 줌으로 만나기로 함. 오늘 줌으로 독서모임. 해외 여행 후 1주일에 한두번 볼 예정. 0203) 27일에 줌으로 만나서 책 40분 읽고 일반 말씀 전함. 2/4일 1시반에 줌으로 또 만남. 0210) 지난주 수요일 독서모임 진행하고 감사에 대한 말씀 전해줌. 오늘 1시에 또 만남 0224) 20일 금요일 줌으로 만나서 독서 모임 진행함. 이번주 시간은 아직 미정. 0306) 나은이의 새로운 모습을 보게 됨. 마음을 많이 연듯. 윤아 패스함. 일정은 곧 잡을 예정.  0311) 목 11-1시 윤아 연결 예정. 말씀을 듣는 건지 어떤걸 할지는 잘 모르겠음.');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('서연우', '국어교육', NULL, NULL, 0, NULL, '무교(관심도 없고 경계심도 없고) - 최근 읽었던 책 싯타르타 말하면서, 호연이한테 종교가 뭔지 물어봄. 작가 헤르만헤세가 원래 기독교여서, 불교에 대한 비판도 들어감,,  유렙중세만화를 딥하게 좋아함 ISTP인가J', 'first_meeting', 21, '2', '24(21)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('김진아', '미생물', NULL, '베이킹', 0, true, NULL, 'first_meeting', NULL, NULL, NULL)
RETURNING id INTO life_id;
END $$;