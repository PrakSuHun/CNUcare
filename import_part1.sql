DO $$ DECLARE life_id uuid; BEGIN

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('권민경', NULL, NULL, '과 친구, (2025 1학기) 러닝', 4, false, '경기도 수원 / 언니 있음 / 교회 다님. 죽으면 천국 가는 거 믿음. 기독교 학교 계속 다님. 교회 목사님이 개척도 하심. / 다른거 비슷 P 높음 / 긱사생 / 러닝크루 들어가게 됨, 행복한 편지 보냈음 유진이가 민경이를 예은이한테 소개시켜줌. - 서로 친하고 유진이 먼저 전초하려 해서 민경이는 텀 둘 것. 보통은 본가 교회 가고 못 갈 경우 새로남교회 다니려 해서 새 가족 신청 안함. 요즘은 새내기배움터, 시험공부 등으로 안 가고 이제 매주 가려고 노력할 것이라 함.  -> (0918기준) 새로남 교회는 멀어서 아예 안 다님. 본가 교회 매주 가고 시험기간엔 충남대교회 다닐 것. / 과생활 열심히 하고 있음 / ymca까지', 'first_meeting', 21, NULL, '25(21)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('6aa67ffe-5c11-4e09-8336-6e9761800fd8', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '6aa67ffe-5c11-4e09-8336-6e9761800fd8', CURRENT_DATE, '(엑셀 데이터)', '0311) ymca 소모임 성경, 예배 듣고 있음. 왜 다니는지는 모르겠음. 기성이라 후순위임.');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('정시온', '자유전공학부', NULL, '러닝', 1, false, '친하게 지낸 고등학교 친구랑 같이 대학와서 종종 만남 술 분위기를 즐김 / 모솔 남친 없음 / 모태신앙인데 본가와 멀어져서 지금은 교회 안 다님 / 긱사 금토일 집감(좋아하는 이성이 있어서 가는거 같음) / 매력적으로 생김..  생각을 깊이 하는 편, 명언을 만들어서 적어놓음, 나는 뭐고 무엇을 좋아하는지 생각함, 모태신앙이라서 중딩 때 친구문제 때문에 힘들었지만 용서하라 말씀에 마음 바꿈 진로 고민은 없음, 깊은 대화를 좋아함, 친한 친구가 같이 대학 올라옴, 매주 금토일 본가(안산)가서 알바함 -알바에 좋아하는 사람있음/ 교회는 안간다고 했는데/ 재수할때 말씀듣고 좋았다고  영어수업에서 발표 걱정 있음 / 본인은 처치맨(크리스천은 아니다) / 방학때 본가를 간다고 함/ 오빠동생사이인거 같음(혜진이한테)', 'first_meeting', 22, NULL, '25(22)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('6aa67ffe-5c11-4e09-8336-6e9761800fd8', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '6aa67ffe-5c11-4e09-8336-6e9761800fd8', CURRENT_DATE, '(엑셀 데이터)', '1016) 예은, 혜진 큐티 같이 하자고 해보기  1023) 오늘 12시에 만나기로했는데 몸이 안좋다고해서 취소됨. 시험 후 날짜 잡기로, 마라톤도 안된다고 했음. 1106) 열정이 많아서 약속이 잘 안잡힘 / 마지막으로 잡아보기 1111) 11/17에 만나기로. 파악, 큐티제안 1117) 만남. 깊은 이야기를 하는 분위기로 일부러 몰아감. 셋다 생각이 깊다는 공감대로. 큐티는 못끔 1118) 우선 이번 방학에는 고향에 감. 다음학기 때 다시 연결하기) 0306) 교양 수업 겹쳐서 만남. 다음에 같이 밥 먹기로 함 0311) 약속 아직 못 잡음. 나중에 만났을 때 전초 생각하고 만나기. 혼자 만날지 언니랑 만날지 생각해보고 알려주기 0318) 남친재파악 필요, 기독교 동아리 조금 관심, 쉐어하우스 살음 -> 혜진에게 패스 (소모임 큐티) 0325) 남친은 못 물어봄. 약속은 잡을 생각 있음. 셋이 만나서 밥 먹고, 예은이는 빠지는 쪽으로 해서 혜진이 전초.  수업 전에 전화해서 같이 앉아. 같이 못 앉으면 디엠 봐달라고');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('이수빈', '언어학과', NULL, '교양', 0, false, 'istj / 가치관X/개발하고싶은데 행동보다는 지식 개발/낯가림도있고/ 타로 안믿 / 과생활 안함 / 동아리(춤?밴드?0 언니들과 친함  / 룸메언니랑 친하다 / 고딩친구들과 연락 별로 안함 / 농대쪽에서 밴드하는건데 거기서 비슷한 성향이 있는거 같다 /  술 싫어하고 진실한 사람을 좋아함 / 모쏠 / 본가 충남 아산 /  1학기때는 매주 본가왔다갔다 / 엄마랑은 안친해보임 / 언니1명있는데 언니욕을 많이함, 안친함 / 무교. 그 이상 얘기 안 해봄 / 소연언니와 청춘백서로 끌었으나 할 생각 없었다고 취소함.', 'first_meeting', 21, NULL, '25(21)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('6aa67ffe-5c11-4e09-8336-6e9761800fd8', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '6aa67ffe-5c11-4e09-8336-6e9761800fd8', CURRENT_DATE, '(엑셀 데이터)', '1016) 북부스 1023) 책을 안좋아하긴 했는데 대학백서 신청함 1104) 소연이랑 이번주에 청춘백서 진행해보기->바로 전초할지, 다음에 할지, 다른 강사에게 연결할지 1106) 청춘백서 취소함/ 예은이가 따로 만남잡고 대학백서 어필 다시하거나 아고라광장으로 연결 1118) 교회에서 자기개발 특강 있다고 하니까 수업도 안가는 판에 교회까지 어렵다 감동이 되는 생명은 아님. 방학 때 남아있으면 다시 생각해보기. 방학 때 거주지 파악=>아산 감.  18일에 만나 간단히 학식 먹었는데 감동 안 되던 것이 무색할 만큼 자기가 1학년 때 인간관계 고민 있었던 얘기도 함. 다시 끌어는 보자. 0306) 약속 못 잡음. 수강정정 기간이라 약속 잡기 어려워하는 듯. 10일 이후에 약속 잡아보기. 0311) 오늘 약속 잡을 예정. 전초 어떻게 할지 생각하면서 만나보기. 3/23 점심약속잡음. (전초: 내 강의 들어봐달라) 0325) 323에 만남. 전초했는데 들어주기로 함. 교환학생 신청해놓아서 연락기다리는 상태.');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('안아진', '농생명융합학부', 'ISTJ', '맛동산', 2, false, 'ISTJ (이모랑 친한데 혜진맘이랑 같은 곳 근무- 혜진 1110 만남 기점으로 바빠서 못 만날 예정) 대구, 매주 본가 감.   부모님이랑 많이 친한 듯하고, 부모님이 걱정을 많이 하심. 교환학생 스페인으로 가고 싶어서 공부조 조금씩 하는데 부모님  걱정하셔서 아마 못 갈 것 같다고 함 / 나이 차이 좀 나는 남동생 있음 / 부모님이 무교라 무교. 죽음이나 사후세계는 무서워서 생각 안 해봤 지만 인생 허무하다 느낌 / I(그런데 활발한 성격, 분위기메이커 같은 사람이고 싶음 - 더 친해지면 아고라 물어볼 수 있을 듯..J (완벽주의 경향이라 안 되면 바로 포기도 쉬움)- 확실치 않지만 ISTJ st / 긱사 / 과 친구들과 잘 놀지만 찐친있는 것 같진 않음.  / 남친 별로 안 사귀고 싶음 / 방학때 본가가고 /  4주전부터 공부시작한다고 함 / 목금공강 토일도 뭐 안해서 매주 본가 감. 엄마랑 친하지만 앵기진 않음 /  식품영양들어감(여기 꽤 센데 ) 화학이 너무 어렵다', 'first_meeting', 21, NULL, '25(21)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('6aa67ffe-5c11-4e09-8336-6e9761800fd8', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '6aa67ffe-5c11-4e09-8336-6e9761800fd8', CURRENT_DATE, '(엑셀 데이터)', '0306) 11일 수요일 6시 저녁에 밥 먹을 예정 0311) 오늘 만남 예정. 교환학생 갔다온 언니 있다고 하면서 설희 언니 소개해보려고 했는데 말을 안한 상황  0318) 디엠으로 설희언니 소개 해보기  -> 교환학생 안 가는 쪽으로 마음 굳혔다고 거절');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('윤다영', '심리학과', 'ISFJ', '주생명 목공예행사 과 친구', 0, false, 'ISFJ/ 대전 중앙로에서 통학 / 3살 차이 나는 서울대 오빠 있고, 엄마아빠랑 화목한 듯 / 무교인데 어릴 때 집 근처 성당에서 유아세례명도 받음,  귀찮아서 잘 안 다님 / ISFJ 낯가리지만 둘이 있을 땐 편하고 웃긴 E가 된다. S 강함 F 그럭저럭 J 반반 / 과생활 열심히 해서 과에 친구가 많다. 최유진(교회트라우마있어서 전초실패,혜진이랑은 끊겼고 예은이랑은 인사만)과 친해짐. 비즈니스적으로 친한 편. / 희조언니에게 고민은 많다 했는데 주변에 잘 말하지는 않는 편인듯.', 'first_meeting', 21, NULL, '25(21)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('6aa67ffe-5c11-4e09-8336-6e9761800fd8', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '6aa67ffe-5c11-4e09-8336-6e9761800fd8', CURRENT_DATE, '(엑셀 데이터)', '0306) 설희언니 9일에 만남. 지난번 4차산업혁명 잘 안 먹혔음. 0311) 이전-벧물, 엘까까지 들음, 얼마나 기억하는지 모름 설희-썬스탑, 재미있게 들었음. 다음주에 또 듣기로 함. 재미있게는 들었는데, 신앙이 안 들어가면 잘라야할 것 같음.  0318) 이번주에 윤아랑 밥약 잡아보기 -> 금요일 with 윤아목사님, 텀 길어서 월요일에도 강의 한 번 더');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('김지유', '농생융', 'ISFJ', '축제-이맛저맛 체험단', 2, false, 'ISFJ / 모태신앙인데 재미없어서 / 아담과 하와가 종교의 조상이니까 맞지 않냐 그렇긴한데 홍해바다 말이 안된다 바닷길 열리는거 / 우리교회는 과학적으로 풀어준다 나도배우고 있다/ 기도는 열심히 한다 의지할데가 필요해서 / 엄마가 대전에서도 교회가라고 / 재미도 없고, 교회 아무데나 가는게 무서워서 /  나한테 성경 알려주는 언니가 있다(예은이->지유에게 언급해둠) / 모솔 / 짝사랑하는 사람 있음 / 술도 안좋아하지만 친구따라 먹고 / 과생활 동아리 열심히 하는편 찐친까지는 아직 / 전북 군산이 본가 / 방학때 안감-엄마의 잔소리가 싫어서 /  매주 주일마다 교회가고 있고, 크리스마스도 갔음. 말씀이 재미가 없어서 교회에서 잠-스트레스받음', 'first_meeting', 21, NULL, '25(21)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('6aa67ffe-5c11-4e09-8336-6e9761800fd8', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '6aa67ffe-5c11-4e09-8336-6e9761800fd8', CURRENT_DATE, '(엑셀 데이터)', '1118) 이맛저맛 체험단으로 만나고 동갑이라 예은이랑 따로 만남 1125) 시험 끝나고 놀자고 해서 예은이가 직접 강의 (강의전 준비 많이 하기) 0106) 예은이가 15일까지 바빠서 빨리 만나기 어려운 상황.(이후로 의논) 0114) 예은이가 전초할 상황이라면 1대1로 만남 약속 잡기. 피드백해달라고 하면 자기가 할 수 있는 질문을 예은이한테 다 할 것 같음. 피드백해달라고 하고 1-2개 듣다가 반응이 좋으면 같이 더 배우자고 하고 넘기면 어떨지? 0120) 19일에 만남. 원래 전초하려고 했으나 방학 때 군산에 있을 것 같아서 개강 후에 할 듯. 엄마랑 떨어진 후에 말씀 넣어봐야 정확한 판단이 될듯. 0306) 11일 만남 예정.  0311) 오늘 만남 예정. 성경 알려주는 언니 있다고 얘기해뒀으니 바로 연결.  0318) 이번주 금요일이나 주말로 바로 잡아보기 -> 자기는 그 언니 안 만나도 될 것 같다고 거절 & 그래도 예은 싫어하진 않음 -> 둘이 큐티 한 번 하자 or 내 강의 한 번 들어줘');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('전민지', '사학과', 'ISFP', '교양(모자예쁘다)', 2, false, 'ISFP / 서구 삼/ 남사친 / 남5여3-썸타서버럭화냄 / 과팅으로 나가서 친구사귀고 돌아옴 / 독일 다녀온 언니가 있음/ 중고딩 친구 무리 3명 이거 고쳐야되 하면 고치는게 추구미 / 학생회(2학년때 제의받음) /', 'first_meeting', 21, NULL, '25(21)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('6aa67ffe-5c11-4e09-8336-6e9761800fd8', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '6aa67ffe-5c11-4e09-8336-6e9761800fd8', CURRENT_DATE, '(엑셀 데이터)', '1125) 타로본다고 해놓고 친구데려온다고 했던. 방학때 친구들 본가가면 얘 타로 봐주기             다음에 예은이가 직접 강의=>얘기X 1203) 크리스마스 행사 3번중에 1번으로 당기기 0106) 예은이가 타로 봐주면서 전초각 보기(연습 대상 되어달라고) 0114) 타로 봐주면서 전초. 0120) 알바+여행으로 방학 때 바쁘다고 못 볼 것 같다 함. 개강 후에 봐야할듯. 0306) 아직 연락 못 해봄. 0311) 오늘 만남 예정. 파악 목표로 만나보기. 서양 역사도 괜찮을듯. 0318) 은비 연결 (거의 바로 전초해달라고)');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('박유진', '전자공학과', 'ISTJ', '베이킹행사', 1, true, '도마동이 본가, 통학. / 부모님과의 관계는 모름. 10살 차이 남동생 / 종교 모름 / ISTJ, 주변을 잘 관찰하고 생각하며 행동해서 눈치&주변 반응에 민감함. 다 좋다 말하기보단 확실하게 뭐가 좋다 말해줘야 좋아하는 편. 배려심 많음. /  공대 학생회 술자리를 잘 나가서 주변에 남자는 많은 듯하나(술 좋아함) 고2때 자기를 좋아해줘서 사귀어 본 애 빼고는 남친 없음. 잠깐 / 고등학교 때 친구들이랑 계속 친하게 지냄. 고딩친구? 대딩친구? 일본여행도 같이 간다고 함./ 공대 학생회 / 엠티 / 일본 여행 /', 'first_meeting', 21, NULL, '25(21)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('6aa67ffe-5c11-4e09-8336-6e9761800fd8', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '6aa67ffe-5c11-4e09-8336-6e9761800fd8', CURRENT_DATE, '(엑셀 데이터)', '0105) 베이킹 이후 5일에 둘이 만나서 놀며 많이 이야기 함. (종교 이야기는 안 물어봄) 몇번(최대2번) 같이 놀고 예은이가 성경들어봐주라 0114) 계속 진행하면 될 듯 0120) 2월에 시간이 된다고 함. MT, 일본 여행 등으로 바쁨. 2월초에 만나보기. 0127) 공대학생회로 바쁜 상황. 오늘 연락해서 2월 초나 둘째주에 약속 잡기. 0203) 답이 늦음. 약속 아직 못 잡음. 0211) 계속 학교 오는 중, 바빠서 만나기 힘들 것 같다 개강 후에 보자고 함.(뭐로 바쁜지는 모름). 0306) 학생회, 친구 많아서 시간 잡기 어려워서 17일날 보기로 함. 종교 파악해보기. 0311) 17일날 보기로 함. 전초 거리를 생각하면서 만나고 오기. 종교파악 및 이성유무 파악. 0318) 본인을 좋아하는 학생회 선배에게 마음 가고 있음. -> 양꼬치 먹자 한 날 후기: 고백은 안 했지만 플러팅 엄청. -> 3/20~22 MT 이후 남친 생겼나 보고 없으면 설희언니 연결 0401) 남친 생김');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('이가은', '행정학부', 'ISTP', '맛동산', 2, false, '태안 (긱사) / 남동생(이제 중딩), 엄마(잔소리~ 막 많이 말하진 않음), 아빠(데면데면함)  불교 (부모님이 불교라서. 독실한 건 아니지만 충불회 동아리 신청함)  긱사 / 1학년 때부터 과 생활 열심히 했는데 좀 빠지고 싶어도 못 빠지고 너무 힘듦. 고딩 때 친구 2명 진짜 친하고 고민얘기 다 함.  대학친구는 맘 편히 친해지진 못하겠다. 남친은 고딩~대1-1학기 때 잠수이별 당하고 남친 생각 아직은.  본인 진짜 속마음은 잘 안 말하고 혼자 생각함. 옳은 길로 가고 싶은 게 추구미. 학생회 너무 힘들지만 그만둘 마음까지는X 사람 많이 없어서 본인이 지도자해야하는 방학때 돈을 다 벌어서 학기때 쓰는 방식으로.', 'first_meeting', 21, NULL, '25(21)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('6aa67ffe-5c11-4e09-8336-6e9761800fd8', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '6aa67ffe-5c11-4e09-8336-6e9761800fd8', CURRENT_DATE, '(엑셀 데이터)', '0318) 0310에 예은이가 만남. 불교동아리 들어가려 해서 성경 피드백 전초 말 못 꺼냄.  (수빛언니 의논: 타종교? 오히려 좋아. 다양한 사람의 피드백 필요한데 한 번 들어달라고 만나서 부탁하기. 의논 후 316 차량 봄) 0324(화)로 약속 잡음. 0324) 피드백 전초 함. 좋다고 함.');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('김경빈', '중어중문학과', NULL, '행티 부스 인터뷰', 1, false, '충남 (?) / 외동, 엄마랑 친함. 고등학교 때 친한 6명 무리 중 1명(7년찐친) 가장 친하고 고민 얘기도 함(안 맞아서 한 번 싸우고 화해함). 다들 아직 연락함. / 남친이나 연애 생각 없음. 다문화 가정이라 중학교~고1 때 남자애들이 부모님 욕, 섹드립 등 트라우마가 될 말들을 했다고 함. 그 영향이 큰 듯. -  지금은 마음 극복해서 ''그때보다 힘들겠냐 열심히 하자'' 마인드로 힘든 일도 해나감. / 무교임. 중고딩 때 기독교 친구 한 명이 먄날 본인에게 성경 얘기를 해서 그러려니 다 들어줌.  선악과를 사과로 알고 있음. 지적 호기심이 있어 강의 재미있어 하나, 이 말이 맞다 보다는 가장 나은 가설이라 생각. / 자기 주장이나 생각이 강함.  무조건 끌리고 좋아하는 일 할 거지만 현실적인 생각으로 안정적인 일도 중요하게 봄. 첫번째 강의 들으며, 옳은 길이 아니더라도 내가 원하는 길을 갈 것이다, 원하지 않는 길 갈 거면 뭐하러 사냐 함. 중구 학사마을 살고, 2주마다 한 번은 본가 감. / 검도•태권도(오래함,잘하진X)•바이올린•경제지식•피아노 등 다양한 분야로 학원 다니며 배우기도 함. 쿠팡 등 단기알바도 해 봄. 엄마가 대학 5개째 다니심, 지식욕구 영향 받은 듯. / 인생에 대한 고민 ''어떻게 살아야 하지'' 생각 많이 (힘들었던 시기 때문에 옥상도 올라 갔는데 무서워서 내려오고 마음 극복), 인문학 넘 중요하다 생각. 많이 배우고 싶어.', 'first_meeting', 20, NULL, '26(20)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('6aa67ffe-5c11-4e09-8336-6e9761800fd8', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '6aa67ffe-5c11-4e09-8336-6e9761800fd8', CURRENT_DATE, '(엑셀 데이터)', '0302) 부스 인터뷰 명목으로 2차 만남 0312) 설희연니 강의연결, 첫 강의 들었는데 엄청 재미있어 함. 대신 가설이다&자기생각 우선. 0320) 이번주 대특 때문에 약속X, 다음주는 해오름제 춤 연습한다고 어렵다 함. 상황 보고 28일 토요일로 날 잡기');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('이예린', '자유전공학부 (언론정보학과)', 'ENTP', '행티 부스 인터뷰', 1, false, 'T가 강하진 않은 엔팁 / 세종 통학 / 오빠2 (이과생들), 엄마아빠 화목하고 친한 집안. / 고딩 때 남친들 있었지만 좋게 헤어짐.  자기를 좋아하는 애들이 많아서 여자애랑 데면해지기도 했지만 잘 얘기해서 풀음. 지금은 연애생각 없음. 과 친구 몇 명 사귐. / 고등학교 때 찐친 있음. /  많은 경험을 하러 대학 왔으니 계획표 꽉 채우기보단 즉흥적으로 할 일 할 수 있는 여백 중요. / 본인이 느끼기에 겁이 많은 편이고 언정 쪽이라 엄청 찾아보는 편. 알아볼 만큼 알아보고 모르겠으면 그때 물어봄.  모든 매체에서 다 동일하게 이야기하는지 중요하게 생각함 (그게 다가 아니라 말해둠) / 자기가 좋아야 하지만 부모님의 의견도 잘 듣고 생각해보고 결정하는 편 /  별 구름 등 지구과학 계열 관심 있음. 진로를 천문학 쪽으로 할까 생각도 함. / 동물 좋아함. 짝이와 꿍이 말티푸 키움. / 학식 뭐가 맛있는지, 선배들이랑 친해지는 법 등 학교 생활 질문 많이 함.', 'first_meeting', 20, NULL, '26(20)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('6aa67ffe-5c11-4e09-8336-6e9761800fd8', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '6aa67ffe-5c11-4e09-8336-6e9761800fd8', CURRENT_DATE, '(엑셀 데이터)', 'pd쪽, 방송자체에 관심이 많음, 예은이 성경 들어봐달라 - 그대로 날 잡으려 했으나 3월 중엔 시간 안 되고 알바 시간도 잡고 있어서 4월 중에 얘기하자 그럼');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('최은우', '건축공학과', 'INTP', '행티 부스 인터뷰', 1, false, '전주 (긱사) / 본인 과 (건축) 많이 궁금해 해서 안정적인 것 추구하는 편인데 요즘은 후회하더라도 끌리는 거 하려 함. 주변에서 괜찮겠냐 할 때 그냥 여기로 옴. /  친구들이랑 있을 때 말하기보단 들어주는 쪽임. 점점 얘기 비중 늘어가며 나도 말 하는 거 좋아하는구나. / 고민 걱정이 딱히 없는. 가장 친한 고등학교 때 친구 3명 있는데 싸운 적 없음. 친구들끼리 성격 안맞아서 싸우면 중재하는 역할. 충대로 고등학교 때 친구 몇, 중학교 때 친구 몇 오고 해서 친구 걱정은 신입생 치고 적은 편. / 종교 모름 /  중학교 때 아주 잠깐 연애했는데 사실상 모쏠. 남친 생각 음… / 3월은 매주 본가 갈 것임. 1시간 밖에 안 걸리고 부모님 연락도 많이 와서. / 이제 고1인 3살 차이 여동생 있음. /  운동 좋아함. 달리기 좋아하고 배드민턴도, 다 좋음. / 공강 때 뭘 하면 좋을까 등 대학생활 질문 많이 하고 더 알고 싶어함. 왜 이름이 소크라테스냐, 왜 심리학과를 가게 됐냐 등 궁금증도 많음.', 'first_meeting', 20, NULL, '26(20)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('6aa67ffe-5c11-4e09-8336-6e9761800fd8', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '6aa67ffe-5c11-4e09-8336-6e9761800fd8', CURRENT_DATE, '(엑셀 데이터)', '0304에 만남 / 0318(다음주 수요일)에 한 번 더 보기로. 더 많이 파악하고 전초각보기. 대학생활 궁금해 함.  + 4차 산업전초안에 건축 좀 녹여서 전초 바로 해보기=> 0318은 취소됨.');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('김은비', '정보통계학과', 'ISFP', '행티 부스 인터뷰', 2, false, 'ISFP인데 F와 P가 강함. I치곤 친구 사귀고 싶단 생각 강해서 말도 잘 걸음, 근데 애들이 단답식 성격이라 아직은 친하지 않음 (0318 좀 친해진 듯 스토리 올라옴) /  키가 커서 맞는 바지 없음 스트레스 + 꾸미고 옷도 사고 놀러다니고 싶은데, 관심은 있지만 3수했고 그간 친구랑 대화도 안 하니 놀 줄 모르는 느낌. / 서대전네거리쪽 문화동 통학 /  기독교인데 교회 안 다님. 찝적거리는 남자들 있어서 너무 싫음, 성경 집에서 따로 읽으며 가정예배 드리는 등 엄마랑 (아버지랑 이혼) 은혜 나누고 그럼. 가족은 엄마,오빠,본인. 베드로와 물고기 성구 얘기하니 ''아 그거 비유인거?'' 바로 답함. 성경 토대로 쓴 고전 등 책도 위험하다 생각, 해석 막 할까 봐. (아는 언니 어떤 분께 배웠는데 과학과 종교 일치되고 재밌더라 깔아둠)  신약 제일 좋고 하나하나 읽을 때마다 깨달음이 다름. / 모솔, 남사친도 없었음. 여기서도 잘 못 대하겠어서 안 만드려 함. 남자 아이돌 많이 좋아함. /  당장 한 얘기만으로는 앞만 보고 사는 느낌이 강함. 1학년으로서의 기대와 불안, 친구 사귀고 싶어, 꾸밀까 말까, 책 많이 읽고 싶다(국어 못해서), 악기 콘트라베이스 배울 수 있는 곳 가고 싶어, 심리학도 관심 좀 있음.', 'first_meeting', 22, NULL, '26(22)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('6aa67ffe-5c11-4e09-8336-6e9761800fd8', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '6aa67ffe-5c11-4e09-8336-6e9761800fd8', CURRENT_DATE, '(엑셀 데이터)', '0318) 0310에 예은이가 만남. 성경 피드백 전초 했고 (2개 정도 들어줘) 이후 연락으로 날 잡으면서 설희한테 틀어보기 0320) 상황 보고 화요일 4시반 날 잡은 후 연락해보기');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('임윤서', '반도체융합학과', 'INTJ', 'AI 특강', 2, false, '세종 / INTJ / 중학교 때 교회를 잠깐 다녔다가 말음. 교리는 별로 기억 안 남, 진짜 친구 만나고 놀러 다녔는데 애들이 점점 안 가서. /  과생활 잘 안하고 그래서 충대에 친구 없음. 중학교 찐친1, 고등학교찐친1 등. 친한 친구 늘 있었음. / 남친 생각 없음. / 영어 학원에서 강의하는 알바 하고 있음.  (확실X)외동?', 'first_meeting', 21, NULL, '26(21)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('6aa67ffe-5c11-4e09-8336-6e9761800fd8', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '6aa67ffe-5c11-4e09-8336-6e9761800fd8', CURRENT_DATE, '(엑셀 데이터)', '0318) 0310에 예은이가 만남. 성경 피드백 전초 했고 이후 연락으로 날 잡으면서 설희한테 틀어보기 0320) 0325에 약속 잡음. 밥 먹고 직접 입문강의1 + 언니 연결하기');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('강예지', '영어영문학과', 'ISTJ', '클린어쓰 노방', 1, NULL, '천안(긱사) / 외동 / 알바 많이함(? 일단 홈플러스 롯데리아) 등으로 본가 많이 안 감, 방학에도 특별학기 할 예정. / 종교모름 / 단답형 성격인 것 치고 질문이나 추가답변 꽤 함. /  교환학생은 경험상 좋겠고 캐나다 그냥 가보고 싶지만 현실적으로 (돈 등) 못 갈 듯. / CC 등 로망은 없지만 막동하고 싶었음. 빠른 시일 내에 같이 막동하자 하니 좋다고 함. /  밤에 공부하다가 폰 10-20분 보고 잠듦. / 친구를 엄청 많이~ 사귀고 싶어하진 않음. 초중고 같이 나온 사회학과 찐친(여자애, 자취함) 있고 과 애들이랑도 조금 친해져서.  친구 더 사귀러는 아니고 그냥 친구 따라 겸사겸사 볼링동아리 들어감. / 고양이 좋아한다 했는데 고양이 카페 막상 얘기하니 얼굴이 확 밝아지고 그런 건 아님. 늘 잔잔한 느낌.', 'first_meeting', 20, NULL, '26(20)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('6aa67ffe-5c11-4e09-8336-6e9761800fd8', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '6aa67ffe-5c11-4e09-8336-6e9761800fd8', CURRENT_DATE, '(엑셀 데이터)', '0331에 둘이 막동하기로 함');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('심수희', '회화과-한국', 'INFP', '클린어쓰 노방', 1, false, '청주(긱사사는데 야작,술약 등으로 잠만 자고 나옴) / 언니3명, 언니들 이름만 부를 정도로 사이 좋음. 부모님을 많이 의지하지는 않는 편 / 종교 모름 /  INFP인데 F강하지 않고 N,P 강함. I라 집 좋지만 친구들이 좋고 (회화과 서로끼리만 엄청 친함, 다른 타과친구 없음) 자기 빼고 노는 게 서운해서 계속 같이 감.  말하기보단 듣는 입장이지만 그중에서도 잘 노는 무리에 속함. / 바람끼 전남친에게 데여서 속상했지만 이후론 사람 너무 많이 믿진 말아야지, 교훈 얻었다 함. /  회화과 친구들이랑 계~~~속 붙어있음. 시간표도 그렇고, 야작도 있어서. 과 내 남자는 1명이라 남자로 안 보이고 과팅 해본적은 있음. 연애 해보고는 싶다. /  영화 동아리 들어갔는데 활동 아직 & 환경이나 봉사쪽도 하고 싶은데 현실적으로 어려울 듯. 플로깅 너무 해보고 싶어! / 공감 잘하는 사람, 다정한 사람 좋아함. /  사람 관찰하기 좋아함, 그래서 연애하는 애 등 잘 알아챔. 섬세함. 상대의 뭔가를 알아주고 칭찬했을 때 ''아 뭐야~''로 끝나면 좀...', 'first_meeting', 20, NULL, '26(20)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('6aa67ffe-5c11-4e09-8336-6e9761800fd8', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '6aa67ffe-5c11-4e09-8336-6e9761800fd8', CURRENT_DATE, '(엑셀 데이터)', '0402에 예카 가기로 함');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('유은주', '화학공학교육과', 'INFP', '클린어쓰 노방', 1, false, '세종(편도1시간)에서 통학, 긱사 가려 했으나 보결도 떨어짐 / 가족 얘기 안 물어봄 / 종교 얘기 안 물어봄 (주말에 집에서 유튜브만 본다 함) /  INFP인데 다 반반, N이 그나마 강함. 현실적 해결책이 조금 더 중요. / 고등학교 때 아주 잠깐 남친 있었지만 노잼, 로망 많았는데 다 깨지는 중. 연애 다 한다더니. 근데 또 막 연애하고 싶은 건 아님. / 과에 친한 친구 1명 있고 안겹치는 날(목요일 등) 아니면 계속 같이 있음. 고민도 털어놓고. / 성적 잘 받는 방법을 너무 궁금해하고 불안해 함. 기술교육과(교육계 관심, 그중 경쟁률 낮은 기술) 복전하고 싶은데 4.0 넘어야 한다 해서 불안. 조언 너무 필요. / 인터스텔라 좋아함 (우주, 별, 달 좋아하는 이유는 인류가 아는 게 아주 조금이라는 게 신기해서.) + 어쩌다 발견한 하루나 도깨비 등 로맨스 드라마도 좋아함. / 노래 듣는 거에 관심이 많음. 예은에게 rock Jpop 추천도 해 줌. / 귀찮음이 많은 편임. 환경 위해서보단 내 몸이 편한 게 좋음. 활동 제대로 막 하는 건 부담인데 조금 실천은 괜찮음. / 잘 찾아보고 하지는 않음. 정말 꽂히는 건 찾긴 하겠지만 굳이? / 환경이 개인의 실천보단 기업이 먼저. 다같이 하는 데에서 오는 뿌듯함이 더 크니까. 분위기 잘 안 따라가는 것 같다고 말했는데 이런 류의 질문에서는 다 크게 먼저 해줘야 개인이 한다~ 류로 답함.', 'first_meeting', 20, NULL, '26(20)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('6aa67ffe-5c11-4e09-8336-6e9761800fd8', life_id, 'evangelist') ON CONFLICT DO NOTHING;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('이나경', '행정학부', NULL, '맛동산', 3, false, '오송(긱사), 3살 차이 오빠, ISFP, 모쏠, 본가 오송, 무교, 외국인 친목동아리(AFKN),  연애하고 싶어함. 11/7에 소개팅했음 이에 관련해서 고민이 생김. 공무원준비할 예정.  자기개발하려고 함(자격증, 토익, 알바)', 'first_meeting', 22, '2', '24(22)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('백지희', '신소재공학과', NULL, '축제-책부스(독립서점)', 0, false, '기숙사 거주, 고향 포항, 방학때 집감. ISFP, 술 안좋아함.', 'first_meeting', 22, '3', '24(22)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('방예원', '무용학과', NULL, '축제-책부스(책수다)', 1, false, '대전 집 통학, ENTP, 이지민친구 부모님 이혼하시고 어머니랑 살고 있음. 어머니, 여동생, 예원 셋이 교회 다님.  동생이 신앙이 깊지 않아서 고민이라고 함, 본가근처교회. 교회 이름은 모름', 'first_meeting', 20, '1', '25(20)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('이지민', '유기재료공학과', NULL, '인맥', 1, false, '기독교 집안(기독교남친만날것, 엄빠새벽기도나가신다),매주 세종 본가 교회감,대전에서 다닐교회 같이 찾아보자, 엄마랑 친함 ISFJ, 방예원친구', 'first_meeting', 22, '2', '24(22)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('김희현', '기계공학과', NULL, '클린어스', 1, false, '군산, istj, 자취, 코로나 전까지 교회다니다가 자연스레 안가게 됨, 성경과 과학이 부딪히는 것 관해 궁금증을 가지고 있음.  귀신이 존재하는가-> 교화 집사님께도 물어봄(성경엔 없다고 하지만 실젠 있다~ 뭐 이런식으로 말했다고 함)  진화론-> 하나님이 아담과 하와를 창조하셨다고 했는데 그럼 오스탈로피테쿠스는? 그냥 아담하와가 오스트랄로 라고 생각하기로 했다. 김정윤하고 선후배사이', 'first_meeting', 20, '1', '26(20)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('박설지', '자연과학융합학부', NULL, '클린어스', 1, false, '밀양, i_ _ _, 10살 어린 남동생이 있음, 먹는걸 굉장히 좋아함, 더보이즈현재 좋아함.', 'first_meeting', 20, '1', '26(20)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('양지우', '미생물', 'ENTJ', '축제- 이맛저맛 체험단', 0, NULL, '고향이 전북익산. 인싸. 세상을 좋아한다고 느낌. 노래도. 본가쪽에서 밴드함. 무교인 애가 기독교를 바라보는 느낌. 본가를가는데 살다보니 신이 있는거 같기도 나중되면 있다고 생각하지 않을까', 'first_meeting', 21, '2', '25(21)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('34962e70-d61c-4733-8263-4313c942817f', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '34962e70-d61c-4733-8263-4313c942817f', CURRENT_DATE, '(엑셀 데이터)', '1203) 11/28(금)에 만남. 교환독서하기로 해서 일부러 책을 빌려줌. 방학전에 전초해놓기 .  나 방학때 선교사준비할건데 강의 전해보는 프로그램 있다. 방학때 열심히 준비할테니까 끝나고 들어줄래? 1210) 변동사항없음. 이번주에 만나서 지난주 의논한 거 하기/ 얼굴보고 베이킹 제안해보기 0107) 개강 이후 연락해야할듯 0309) 아직 안 만남. 오늘 연락 예정 -> 만남 약속 잡고 재전초 0323) 개강까지 지금까지 금비가 많이 바빴어서 이번주에 만나기');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('정연우', '전자공학과', NULL, '베이킹', 0, NULL, '예은 베이킹 생명(박유진)이랑 친구', 'first_meeting', 22, '2', '25(22)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('34962e70-d61c-4733-8263-4313c942817f', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '34962e70-d61c-4733-8263-4313c942817f', CURRENT_DATE, '(엑셀 데이터)', '0107) 베이킹 후기 : 생명은 괜찮았는데, 친구들이랑 같이 와서 연락처만 받아놓음. 예은이 생명 먼저 해보기. 0323) 박유진이 남자랑 잘되면- 클린어스 인터뷰 제안해서 파악');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('손예원', '농생명융합학부', NULL, '먹짱 초대장', 0, false, '언니 한 명(24살) 언니랑 친함. 언니는 자취함(충대는아님). ISFJ. 내향적임. 개강 후 긱사. MT, 도서관에서 공부하는 것 로망 있음. 술 마심. 관심사 : 예쁜 카페, 독서, 노래방.', 'first_meeting', 20, '1', '26(20)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('34962e70-d61c-4733-8263-4313c942817f', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '34962e70-d61c-4733-8263-4313c942817f', CURRENT_DATE, '(엑셀 데이터)', '0122) 개강 후에 만나자고 함 : 깊티 받고 같이 만나자고 하기. 0309) 아직 안 만남. 오늘 연락 예정.  0323) 지금까지 금비가 많이 바빴어서 이번주에 만나기');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('박시은', '천문우주과학과', 'INTP', '행티 부스', 0, false, '여수, 학사마을 자취중, 아마 계속 대전에 있을듯, 타악기 3년했음. 대학원 들어갈 생각,  술 마심. 기독교-부모님도 기독교여서 고등학교 때 안 다님', 'first_meeting', 20, '1', '26(20)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('34962e70-d61c-4733-8263-4313c942817f', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '34962e70-d61c-4733-8263-4313c942817f', CURRENT_DATE, '(엑셀 데이터)', '0309) 3월 3일에 만남. 솔오케 들어오기로 함. 친구 사귀고 싶어함. 0323) 이런저런 상황때문에 솔오케 4월중에는 오지 않을까? 차라리 따로 만나기');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('이나경', '농생명융합학부', 'ISTP', '클린어스 노방', 0, false, '인터뷰 왜 해줬냐고 물어보니 대학와서 이것저것 경험을 하고 싶었다고.', 'first_meeting', 20, '1', '26(20)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('34962e70-d61c-4733-8263-4313c942817f', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '34962e70-d61c-4733-8263-4313c942817f', CURRENT_DATE, '(엑셀 데이터)', '0323) 농생명융합은 분반으로 움직여서 손예원과 모르는 사이일수 있음. 이번주에 만나기');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('김유민', '무역학과', 'ISFP', '클린어스 노방', 0, NULL, '친구 사귀는게 고민이라고, 기숙사,', 'first_meeting', 20, '1', '26(20)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('34962e70-d61c-4733-8263-4313c942817f', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '34962e70-d61c-4733-8263-4313c942817f', CURRENT_DATE, '(엑셀 데이터)', '0323) 인터뷰 한 상황 한번더 만나기');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('김민정', '영어영문', NULL, '먹꺠비', 0, NULL, NULL, 'first_meeting', NULL, NULL, NULL)
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('34962e70-d61c-4733-8263-4313c942817f', life_id, 'evangelist') ON CONFLICT DO NOTHING;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('장혜윤', '반도체융합학과', 'ESTP', '축제-책부스', 3, NULL, '본가 대구 / 자취 / ESTP/ 자기개발서 좋아함 / 호주 워홀 가보고 싶다 / 씩씩해서 좋음 / 자기가 주도해서 여행가는거 좋아함 / 극P  / 책을 많이 읽고 싶지만 잘 안된다 / 자기를 표현하는 색 = 무지개 / GMG / 정승제 따지지말라는 이야기를 듣고 안좋은 상황 /   교회는 안다니는거 같음(추측) 소연이가 교회이야기했을때 / 친한친구 관련해서 고민이있었음-중학교떄친구 중학교때 끝나고 /  마음가는 친구 3명정도 만남 -친한친구가 뭘까요', 'first_meeting', 20, '1', '25(20)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('이승비', '경영학과', 'ENTJ', '먹짱 초대장', 1, NULL, '본가 세종/ 털털한 친구 / 먹을 거 좋아함(그래서 먹짱도 신청) / 책 읽는 거 좋아함', 'first_meeting', 20, NULL, '26(20)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('공예주', NULL, NULL, '대특', 0, NULL, NULL, 'first_meeting', NULL, NULL, NULL)
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('박채연', '스포츠과학과', NULL, '행티 부스 인터뷰', 1, false, '본가 대전이지만 자취/ 동아리 활동 열심히 함/ 전과 생각 있어서 과생활은 별로 안함/ adhd약 복용중', 'first_meeting', 22, '2', '25(22)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('예주', '간호학과', NULL, NULL, 0, NULL, NULL, 'first_meeting', NULL, NULL, NULL)
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('신지수', '언론정보학과', NULL, '먹짱 초대장', 1, true, '먹짱 부산부터 옴 / 충남대가 넘 좋음 / 부산 / intj / 5살 연상 오빠있음 / 35일된 연상 남친있음 /  특별학기 신청해서 2월에 셤보러 학교 온다했음 / 먹을 거 좋아함 / 책 읽는 거 좋아함(마음이 따뜻해지는 책 좋아한다고 했었음)', 'first_meeting', 20, '1', '26(20)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('675f81f5-f643-4e26-9cb5-9eb98e36a8d2', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '675f81f5-f643-4e26-9cb5-9eb98e36a8d2', CURRENT_DATE, '(엑셀 데이터)', '0120) 35일된 남친 있음. 남친이 잘 챙겨줘서 꿈에 그린 연애를 하는 것 같다고 남친은 반수 예정(3수인듯?). 남친 충대 안 오면 가능성 있어보임. 우선 학기 중에 한 번 더 보면 좋을듯.(아니면 AI특강 때 불러봐도 좋을듯) 근데, 지수가 번호 교환 안함. -> 공차 깊티 빌미로 물어봤다고 하면 될듯. 0127) 깊티 얘기하면서 연락함. 부산에 있어서 대전 올때까지 기다릴 예정. 연락달라고는 했는데 진짜 줄지는 모르겠음. 0210) 행티 (낼인데) 언제 오냐 하면서 카톡 넣기 0224) 3월초에 만나기로 하고 좋다고 했었음. 이번주 안으로 연락해서 약속 잡기! 0306) 남자친구 부산에 있음. 장거리 연애에 대한 불안이 있으면서도 헤어지기는 싫어함. 헤어질 때까지 좀 두고 봐야할듯. 동아리에 관심 많음(배드민턴, 봉사동아리 신청 예정) 0311) 이성 때문에 후순위. 헤어질생각X');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('김민영', '약대', NULL, 'Ai', 0, NULL, '순수함, 약대는 취미로 돈을 벌어놓기 위한 수단으로 들어온 거라고 함. 세상에 일어나는 재해로 일어나는 피해를 막고 싶어함. 모태 천주교지만 초딩 이후로 안 다님, 어머니 간섭 많이 받음, 본인은 안 좋아하지만 착해서 엄마말 잘 따름.', 'first_meeting', 21, '1', '26(21)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('675f81f5-f643-4e26-9cb5-9eb98e36a8d2', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '675f81f5-f643-4e26-9cb5-9eb98e36a8d2', CURRENT_DATE, '(엑셀 데이터)', '0306) 지수 은비 민영 셋이서 치킨 먹음. 엄청 착함.  0311) 은비언니랑 상의해서 내용 올려주기. 3/29 지수 공연 때야 만날 수 있음. 0325) 공연 때 은비민영 같이 앉음. 그날 행사 후 만나지는 못함. 은비언니랑 의논해서 향후 계획하기. 0331) 연주회 후 은비가 혼자 전초함. 4/3 첫강의하고 막동');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('김민서', '응용화학공학과', NULL, '러닝', 0, false, '대진설때 인상깊었다고함. 미래에대해 생각 화학과 수학이 너무좋다 국어와 영어가 빠진 고등학교같아서 좋다 부모님과 사이가 각별한듯 25살인 언니가 있음 / 계룡 /남친X/ 무교', 'first_meeting', 21, '1', '26(21)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('675f81f5-f643-4e26-9cb5-9eb98e36a8d2', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '675f81f5-f643-4e26-9cb5-9eb98e36a8d2', CURRENT_DATE, '(엑셀 데이터)', '0306) 2월 말 게스트런에서 만남. 3월달 안으로 전초, 연결 도전 0311) 지수랑 말하다가 누가 헌팅을 했는데 이상한 종교면 어떡하냐고 했음. 노방 당할 스타일 아님. 러닝은 후순위인 듯, 지수 좋아함. 지수의심은 안 하는 것 같음. 융합형인재에 관심 있음 -> 전초하려면 좀 더 친해져야할듯, 한 번 더 만나보기. 0325) 연주회 후 다시 약속 잡아보기. 이때 설희언니까지 연결 0331) 밥약잡기. 이때 설희와 같이 만나는 것. 먼저 설희랑 연락하기');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('전서희', '원예학과(복전:무역)', NULL, '맛동산', 0, false, NULL, 'intro', 23, NULL, '.(23)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('6e73a2fe-369e-4d9b-a770-18bd9ec66840', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '6e73a2fe-369e-4d9b-a770-18bd9ec66840', CURRENT_DATE, '(엑셀 데이터)', '0904) 선생님께 편지보내서 답장 옴 "서희 열심히 해 친구들도 월명동 구경시켜주고 안녕" 1002) 충대에서 월캠단장2명과 함께 큐티, 목금 강의 들을 예정,  친구 어떻게 끌지 연구중 스피치 쪽으로 생각하고 있음 1023) 큐티도 현희가 꾸준히해주고 있고, 예배 오고 있음 1120) 1214 수료식 예정 1121) 봄언니랑 만남. 스스로 확신을 갖고 신앙하는 것이 중요함을 깨닫고 전환되고 있음. 현희랑 큐티하며 좋은 자극을 받는듯하다고.  인턴 준비중임.  골프물류 중소기업 인턴(9~18시)합격일 것 같은데 기도해보고 결정하기로. 금융보험 진로는 대중적으로 생각한 것이고  자기탐구를 해본 적이 없어 진지하게  생각하는 시간을 가지겠다고 함. 1204) 보여줄게 이것이 섭리다 다녀옴-신입생에게 주시는 말씀듣고 움. 쌤 보고싶다고함. 유예는 안할듯 , 방학때 둔산동에서 인턴 행정업무 0106) 주일 꾸준히 나옴. 이브, 크리스마스 행사 잘 참여함. 송구영신, 일출도 참여. 주일 금산영광도 함께. 월캠 신년회도 함께 함. 충대 알고 있는 얼굴 밝히면 좋겠다. 1/8 전에 설희-서희 인사 0113) 설희-서희 인사 약속 잡는 중. 보현,수빛, 지수를 어떻게 만나야 자연스러울지 고민됨 -> 일단 설희 만나보고 생각하기. 0120) 설희 만남. 근로하는 동안에는 뭔가를 더하긴 어려울 듯. 자기 신앙 지키는 게 우선. 선교하고 싶은 마음도 있어보임. 충대에서 뛰려면 민정 오픈해야할듯. 우선 근로하는 동안은 오픈X 1학기 한남대 뛰어보면서 선교 모사에 대한 부분을 알게 되면 2학기부터 충대 올 수 있지 않을까.  -> 모사에 대해서 전체가 의논 필요함. 0127) 변호사님 모임 왔음. 얼굴 노출 대충 둘러댐. 보현_서희가 먼저 인사. 민정 섭리 온거 어제 처음 알았다고 함. 혜진_섭리사람. 현희_보화랑 같이 단톡에 있는 거 기억해냄 0203) 예배 계속 나오는 중. 변호사님 모임도 왔음. 0210) 민정이는 서희를 예배 때 보는 게 전부. 현희랑 꾸준히 큐티 중-매주는 아니고. 담주부터 성경학교 오기로 함. 316 전에 성자론, 휴거를 같이 듣기로 함. 행티부스 노방 같이 하기. 옆에 챙겨줄 사람이 있으면 좋겠음. 없으면 담주목금 현희가 챙겨서 0224) 서희 어제 용속목사님과 식사를 했고 낼 졸업이라 월캠이랑 같이 축하하러 가기로 했러요 (일정은 맞춰보자고 얘기가 된 것으로 알고있고 현희 진영 쪽에서 맞춰보고 있는 것으로 알고 있어요 0323) 서희 공차알바중. 이번주 수요일 새벽싱어. 예배 잘 나오고 있음');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('권서영', '생물환경화학', NULL, '축제-이맛저맛 체험단', 0, false, '광주광역시,2녀 중 장녀,무교,esfj(j90 나머지 반반),동생이 본인을 좋아하고 사이가 좋음. 고민이 있으면 엄마한테  얘기하고 가족들하고 해외여행도 다니는 등 사이가 좋은 듯함. 초6때 캐나다 6주 어학연수 경험이 있고 지금까지 여러 나라 (일본,마카오,캐나다,미국)를 여행한 적이 있다고 함. 첫째 부담과 스트레스보다 부모님의 지지가 있는 편이라 함.  좋아하는 것) 방탄 중딩때부터 좋아하고 kpop을 좋아함. 수능 이후로 블로그 비공개 일기를 매일 쓰는 중.  언어를 좋아하고 교양과목을 많이 들음(중국어 프랑스 독어 일어) 그 중에서 중국어가 재밌다고 함. 기아 팬 야구보는거 좋아함. 철학을 싫어하는 정도로 관심이 없음. 생각을 깊이하는 것은 안좋아하는 듯함. 계절학기 관심없고 별 반응이 없음.  한달 전부터 시험준비하는 편이고 꾸준히 장학금 받아옴. 피부가 안좋아져서 보니 밀가루 알러지가 있어 7월부터 안먹는 중. 같이 맛집 가자고 함. 비슷한 점이 많다고 좋아함.', 'pre_visit', 20, '2', '25(20)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('6e73a2fe-369e-4d9b-a770-18bd9ec66840', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '6e73a2fe-369e-4d9b-a770-18bd9ec66840', CURRENT_DATE, '(엑셀 데이터)', '1109) 체험단 첫 만남. 맛집식사 약속함. 해외취업 관심? 글로리아 언니 연결? 1111) 중국어 온라인 수업 같이 듣기로.  1113) 글로리아,정운언니랑 대면 중국어 수업받고 정운언니 말씀전초로 연결 예정. 그러나 방학때 본가를 가고 정운언니도  1.2월 바빠서 강의불가. 내년에 제대로 전초+말씀 하기로. 중국어 해보되 계속 할 순 없으니 민정 미라클 모닝을 한다던지,책읽기를 줌으로 한다던지로 관계성 유지 1119) 글로리아언니 만남. 중국어 단어 문장 조금씩 얘기함. 온라인 연결 바로 안했고 연락처 공유만함. 얘가 더 배우고 싶어하는 의지가 있으면  그때 연결. 일단 민정 식사.카공으로 관계유지하다가 방학때 같이 미라클 모닝하기. (글로리아 언니: 얘가 똑똑하고. 언니가 어떤 사람인지 궁금해하는 느낌이었음. 온라인 강의는 자연스럽게 시간을 두고 연결하면 좋을 듯함.) 1120) 중국어 수업 어떻게 될지 몰라. 미라클모닝으로 이어가기. 독서모임은 종강하고 한번 더 얘기해보기 1126) 중국어 온라인 수업 제안했고 시험이라 스터디 집중하기 어려워서 방학때 하기로. => 날짜 잡기 1204) 중국어 수업 고사함. (영어에 더 집중하기로) 방학때 뭘 더 같이 하기가 어려움. 3월에 다시 만나야할듯 0224) 설겸 안부 연락해서 개강하면 만나자고 한 상황. 0317) 이번주는 시간이 안 맞아서 못 만남. 담주로 다시 잡아보기  0323) 29일에 토익시험이다고 끝나고 보기로.  0330) 시험기간 전에 1번 만나기 목표. 만나서 들어달라. 시험 때문에 어려우면 시험기간 끝나고 들어달라->금 점심 만남예정');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('김정완', '화학공학교육과', NULL, '교양 수업', 0, false, '전과 생각중, 로봇쪽에 관심있음, 전초할 때 4차 산업 쪽으로?, sf영화 판타지 로맨스 영화, 여러지역에 친구가 많다  이유를 물어보니 당황하면서 온라인으로 모임해서 만났다함  독서모임을 했다함 (-> 0915 기준 이상한 거 아니었음. 친구들과 오픈채팅 만들어서 말 그대로 온라인으로 모임하는 거였고,  고등학교 친구들이라 지금은 뿔뿔히 흩어져서 타지역 된 것.) 예은이가 구세주 같았다 함, 성경에 대해서 아예 모름, 무교, 믿음은 있지만 종교자체에 관심이 없다?,  교회다니는 사람과 처음 친구해봤다, 사이비에 대한 인식이 있음,  본가 경기도 의정부, 과친구들이랑 잘 지내지 않음, infj, 24시간 내내 생각, 밤에 불면증이 있어서 3시에 잠듦 /  고민상담을 동생한테는 잘 안한다고 / 지금 긱사 /고등학교때 남사친이랑 2달정도 사귐(책부스에서 이전사람이 그립다)/ 편입도 고민중, 전과는 확실히 할 예정/ 방학때 남는지는 모름=>방학때 안남음', 'first_meeting', NULL, NULL, '25(04'')')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('6e73a2fe-369e-4d9b-a770-18bd9ec66840', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '6e73a2fe-369e-4d9b-a770-18bd9ec66840', CURRENT_DATE, '(엑셀 데이터)', '1118) 봄언니 연결받는다고 함. 아직 정완이는 모름. 이번주~담주 안으로 약속 잡기.계절학기 안들으면 3월까지 잘 관계유지하다가 봄 언니 연결하기 1126) 약속잡아서 만났고 방학때 고향가는걸로 파악됨. 방학때 줌으로 독서모임 1대1로 하다가 개강하면 봄 연결 0106) 독서모임에 대해 톡 반응 없음. 개학하고 만나기 0224) 설 안부에 답 없음. 답 안 오면 그냥 끝내기. 0317) 어제 만남. 민정이를 좋게 보고 있음. 1~2개 들어봐줄래? 하기에 민정이가 자신감이 부족해서. 봄언니소개했더니 정완이는 좋아함. 아니면 예은이처럼 나 피드백 들어줄래 하고 바로 강사 연결 0323) 봄언니 바로 연락->봄언니랑 4월 2주차부터 만남 가능.  0327)설희언니만남 학창시절 우울증으로 3년 상담받음. 왕따를 당했던 적도 있음. 가끔 담배. 어려움을 다 이겨냈다고 보이지는 않음.');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('곽희정', '신소재', NULL, '클린어스 노방', 0, false, '천안.1년자취.진로.인간관계고민. 가계 부담을 덜기 위해 빨리 취업하고싶다.(경제적으로 힘든거 아니고 장녀마인드) 무교 부모님도 종교없으시고  친구따라 다녀봤던게 전부. 주변인의 영향을 많이 받는 스타일. 개강2주차 매일 부모님이 퇴근길에 연락하심(일상공유).', 'first_meeting', NULL, NULL, '26.0')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('6e73a2fe-369e-4d9b-a770-18bd9ec66840', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '6e73a2fe-369e-4d9b-a770-18bd9ec66840', CURRENT_DATE, '(엑셀 데이터)', '0317) 2차로 인터뷰하면서 만남. 이번주 중 한번 더 만나보려고 했는데 민정환희 시간 안 맞음.  민정이 혼자 만나서 끌지, 환희가 혼자 만나서 끌지 이 부분 두고 환희민정(수욜에) 대화해보기 0319) 민정시간되서 둘이 만남. 성경피드백 해주겠다고 함. => 전초강사한테 돌려보기  0330) 목욜에 수빛 강의. 입막음 무조건. 무신인지 파악?');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('최윤서', '경영', 'ISTJ', '대특(3.19)', 0, NULL, '세종.장녀(여동1).ISTJ(T강함). 야구직관메이트 사귀고 싶음. 1학기 과에서 잡아준 3과목 외에는 다 교양넣음 17학점이수. 과동아리1개, 비대위 들어감.  학창시절 반장부반장은 해본 적 없으나 스스로 감투쓰는 것을 좋아한다고 표현함. 얼굴이 어두운 편이고 알바 지원 10곳에 다 떨어졌다고 함. 자기고집이 있는 성격. 엄마가 기독교에 다니지만 본인은 다니지 않음. 신이 있을 것 같냐는 질문에 무슨 일이 있을 때 왜 신만 찾는지 이해가 안된다. 그리고 무언갈 바라볼 때 대게 비관적으로 바라보는 편임. 안좋을 경우를 먼저 생각하는데 이러한 사고방식을 가지며 안좋았던 경험들은 없었기에 (긍정적인 사고 방식이라던지) 생각을 변화시키고 싶은 마음은 없음. 누군가를 사귐에 있어서 좋아하는 사람이면 좋은 점을 바라보려고 하고 안좋아하는 사람이면 부정적인 면을 더 보는 편. 어떤 사람에 대한 평가에 있어서 안좋은 얘길 들으면  그것이 먼저 인식이 되어 그 사람을 알아갈 때 그 부분이 보일 경우 부정적으로 보게 됨. 스스로 커리어우먼이 되고 싶다고 하나 이를 위해 자기개발 등에 노력하고 있는 부분은 없음.', 'first_meeting', NULL, '1', '26(07'')')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('6e73a2fe-369e-4d9b-a770-18bd9ec66840', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '6e73a2fe-369e-4d9b-a770-18bd9ec66840', CURRENT_DATE, '(엑셀 데이터)', '0319)대특만남.나중에 같이 막동하자고 번호공유. => 일반단체. 보현이 시간되면 셋방 만들어서 28토 특강 가보고 민정이는 일정있어서 빠지기  ->본가감. 막동잡기 0330) 막동 잡아서 언니들 중 1명 가서 10분이라도 앉아서 얘 파악 0401)민정 개인만남.');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('최은율', '영문', 'ISFP', '먹깨비', 0, false, '청주.자취.1남1녀중 장녀.ISFP.타과 친구들 사귀고 싶어서 먹깨비 신청함 외에도 보드게임,주식투자?동아리 신청했음.고딩때 사탐은 생윤 사문함.  대학에서 2달 안되게 CC로 사귄 남친있었음.과팅도 여러번 나가본 적 있음. 철학은 관심이 없고 본인들 생각이라 생각하고 본인 취향은 절대 아님을 표현함. 쉴때 보통 친구들하고 통화하고 잠에 든 적이 있을 정도로 친구들하고 대화하는 걸 좋아함.  자취하고 혼자있는게 외로워서 친구들을 집에 부름. 공부는 집에서 하는 편 밖에서는 집중이 잘 안됨', 'first_meeting', NULL, '2', '25(06'')')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('6e73a2fe-369e-4d9b-a770-18bd9ec66840', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '6e73a2fe-369e-4d9b-a770-18bd9ec66840', CURRENT_DATE, '(엑셀 데이터)', '0323)먹깨비 첫만남. 전에 회장이 전도할 시, 악평 위험이 있어 안하자고 했던게 생각나서 영문과 언니(설희언니) 소개해준다고 하니 좋다고 함. 성향 상 강의 듣자로 하면 들을 것 같은데 깨달으면서 잘 들을지는 모르겠음. 0330) 죄송하다. 다음에 뵙겠습니다. -완곡한 거절인 것 같아서, 후순위. 김민정(금비)을 하던, 다른 영문과를 하던');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('윤서', '농생융', 'ISFJ', '클린어스 노방', 0, false, '둔산.통학러.2녀중 장녀(5살차이 여동생).ISFJ.무교 부모님도 종교없음 성당교회가본적도 없음.남녀공학 졸업. 친구들 영향을 받는 편이라 표현함 주변에서 하면 같이 따라서 하는 편.  클린어스 질문 중 텀블러 사용도 주변에서 친구들이 사용하면서 본인도 시작했다고 함. 26년1학기 화수목 오후강의 18학점,  보통 학교-집 왔다 갔다함. 간호학과 가고 싶어했지만 본과로 옴 편입, 전과 생각은 없음. 고민 관심사도 딱히 없고 남친 사귀고 싶은 생각, 연락하고 있는 사람은 없지만  주변에서 사귀니까 본인도 사귀고 싶은 마음임. 고민이 있으면 친구들과 야기해서 털어놓는 편임.', 'first_meeting', NULL, '1', '26(07'')')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('6e73a2fe-369e-4d9b-a770-18bd9ec66840', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '6e73a2fe-369e-4d9b-a770-18bd9ec66840', CURRENT_DATE, '(엑셀 데이터)', '0326) 인터뷰. 민정보현만남. 담주 같이 밥먹으러 가기로.  0330) 목 점심에 만남.');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, grade, student_id_number)
VALUES ('이윤지', '간호', NULL, '클린어스 노방', 0, false, '익산.긱사.2녀1남 둘째.개신교. 언니가 세종에 있어서 종종 놀러감. 엄마는 불교인데 이모가 권사님이심. 고딩떄 권유해서 다니기 시작 했으나 고3수험생활 들어가면서 잘 안나감. 교회 사람이 충대선배 소개시켜준대서 재학생 영문과?만났으나 몇 번 만남 후 본인 졸업생? 이라고 했고 성경공부를 권유함. 이 상황을 엄마에게 전했고 논의 후 제안 거절함.', 'first_meeting', NULL, '1', '26(07'')')
RETURNING id INTO life_id;
END $$;