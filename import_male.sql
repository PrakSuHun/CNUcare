DO $$ DECLARE life_id uuid; BEGIN

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('김동열', '수학교육과', 'istp', '이맛저맛', 0, false, '교사가 되는 것이 진로 a플랜(왜 교사가 되고 싶은지는 개인 비밀) / 극 I라 엄청 조용조용 / 기숙사 8동 / 축구 좋아함(스트라이커), 보는 것도 좋아해서 해외 축구도 많이 봄(손흥민, 토트넘, 프리미어리그) / 동아리는 별로 생각 없다고 함(그래도 동아리 이야기 하다보니 과 동아리(축구 동아리 좀 관심 있었다고 함) / 책에는 관심 없음 / 같은 고등학교 친구가 심리학과 합격 / 군대는 1학년 끝나고(2월 신검). /신천지 거부감이 강함.', 'first_meeting', 20, '20(25학번)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('윤동현', '수학교육과', 'ENTJ', '이찬혁', 0, false, '종교: X / 거주: 기숙사(아산) / - 거절 잘 못함. 부르면 무조건 나감. - 이성친구 1학년땐 사귈 생각 없음. - 가족들과 관계가 좋음. 거의 매일 연락. 주말마다 본가 내려감. - 어머니가 몸이 아프심. 그래서 어머니 도와드리러 자주 내려감. - 가장 존경하는 사람 아빠, 평범하지만 자기에겐 특별함. - 가족들이 예의를 굉장히 중시함 - 꿈은 세상의 모든 지식을 다 아는 것. 특히 수학 부분.', 'first_meeting', 20, '20(26학번)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('a8279044-3156-48ba-a108-f7044f5c823c', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, 'a8279044-3156-48ba-a108-f7044f5c823c', CURRENT_DATE, '(엑셀 데이터)', '- 3/25 : 다음주 중에 만나서 전초해보기.');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('나환주', '경영학부', NULL, '이찬혁', 0, NULL, '- 배구동아리', 'first_meeting', 20, '20(26학번)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('8d1278f1-ea51-4c50-9a4e-82ffc1168e2f', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '8d1278f1-ea51-4c50-9a4e-82ffc1168e2f', CURRENT_DATE, '(엑셀 데이터)', '- 3/25 : 레이스 배구단 제안하기. 현도 오늘 연락. 멘트짜보기.');
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('dab0446a-7f19-4260-b176-7dffb06ca3c4', life_id, 'evangelist') ON CONFLICT DO NOTHING;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('강현', '정치외교학과', NULL, '이찬혁', 0, NULL, '거주: 기숙사 / - 명주완 친구 - 다문화 가정 - 대특때 입시 얘기만 많이함 - 취미 없음 - 태원이가 보류라고 함', 'first_meeting', 20, '20(26학번)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('8d1278f1-ea51-4c50-9a4e-82ffc1168e2f', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '8d1278f1-ea51-4c50-9a4e-82ffc1168e2f', CURRENT_DATE, '(엑셀 데이터)', '- 3/25 : 왜 보류인지 물어보고, 현도가 밥먹자고 연락하기.');
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('dab0446a-7f19-4260-b176-7dffb06ca3c4', life_id, 'evangelist') ON CONFLICT DO NOTHING;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('곽도현', '인문사회융합학부', 'ISTJ(?)', '이찬혁', 0, false, '종교: 기독교 / 거주: 기숙사 / - 사람 많이 사귀고 싶어함 - 술 안마심 - 주말마다 교회에서 사역해서 본가 내려감', 'first_meeting', 20, '20(26학번)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('a8279044-3156-48ba-a108-f7044f5c823c', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, 'a8279044-3156-48ba-a108-f7044f5c823c', CURRENT_DATE, '(엑셀 데이터)', '- 3/25 : 최대한 빨리 만나서 바로 전초하기. 경석 오늘 연락.');
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('5eac0047-e061-4702-b5b2-53dcb1b253eb', life_id, 'evangelist') ON CONFLICT DO NOTHING;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('명주완', '정치외교학과', 'ISTJ', '이찬혁', 0, false, '거주: 통학 / - 강현 친구 - AI에 관심이 많음 - 따로 만나서 카페 사주겠다고, AI 정보 달라고 함', 'first_meeting', 20, '20(26학번)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('a8279044-3156-48ba-a108-f7044f5c823c', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, 'a8279044-3156-48ba-a108-f7044f5c823c', CURRENT_DATE, '(엑셀 데이터)', '- 3/25 : AI특강 신청함. 일반단체 가입시키기. 무조건 가입할듯.');
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('5eac0047-e061-4702-b5b2-53dcb1b253eb', life_id, 'evangelist') ON CONFLICT DO NOTHING;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('인현식', '생명정보융합학과', NULL, '이찬혁', 0, true, '종교: 어릴 때 1년정도 성당 다녔음 / 거주: 자취 / - 술 좋아함 - 동기중에 혼자 군대 안감. 여친때문에 군대 미룸.', 'first_meeting', 21, '21(25학번)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('9d778e37-4b61-4e6a-9974-56370a1686e8', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '9d778e37-4b61-4e6a-9974-56370a1686e8', CURRENT_DATE, '(엑셀 데이터)', '- 3/25 : 후배중에 괜찮은 친구 동주형이 소개받기로 함. 선우가 동주형에게 물어보기.');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('강지원', '정보통신융학부', 'ENFP', '이찬혁', 0, NULL, '거주: 통학 / -축구 좋아하나 요즘은 안하는 중 -논함(토론 동아리)', 'first_meeting', 20, '20(26학번)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('9d778e37-4b61-4e6a-9974-56370a1686e8', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '9d778e37-4b61-4e6a-9974-56370a1686e8', CURRENT_DATE, '(엑셀 데이터)', '- 3/31 : 현도 선우 지성 장원이랑 밥먹기로 함. 오늘 카톡방 만들어서 물어보기.');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('조유현', '농생명융합학부', 'ESFP', '이찬혁', 0, false, '종교: 천주교 1년정도 다님 / 거주: 기숙사 / -노는거 좋아함. -경석에게 진짜 좋은 사람 같다고 함 -뭘 하든 재미가 중요함. -자기는 자유로워서 종교와는 안맞는 사람같다고 함', 'first_meeting', 20, '20(26학번)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('a8279044-3156-48ba-a108-f7044f5c823c', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, 'a8279044-3156-48ba-a108-f7044f5c823c', CURRENT_DATE, '(엑셀 데이터)', '-3/31 : 경석 따로 밥먹자고 연락하기. 각 나오면 전초.');
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('5eac0047-e061-4702-b5b2-53dcb1b253eb', life_id, 'evangelist') ON CONFLICT DO NOTHING;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('김민성', '사회학과', NULL, '러닝', 0, NULL, '거주: 논산 / 1/6 입대', 'first_meeting', 21, '21(23학번)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('김민종', '원예학과/산림자원복전', 'INFJ', '러닝', 0, NULL, '거주: 궁동 당진 / -초등학교 때 야구했음 -10대 때 세종에서 한 마라톤을 못 잊고, 봄에 10km 마라톤 나가고 싶어서 러닝크누 들어옴. 직전 3개월간 혼자 뛰었음. 먼저 실력늘리기 위해 일주일에 한번은 같이 갑천에서 뛰자고 하심. -평일, 주말 상관 없이 격일로 뛰었다고 한 것으로 보아 교회는 안다니는 듯함(정확한 파악 필요) -첫날부터 (지민한테) 말 놓음. 붙임성은 좋은듯 -복원이가 번호땀. -군대면제 -일본성공학책 -아버지가 조경일하셨음.', 'first_meeting', 25, '25(23학번)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('강수현', '신소재공학과', 'ISFP', '러닝', 0, false, '종교: 통일교 / 거주: 기숙사 / - 인간관계 : 부모님과는 1달에 1,2번씩 안부차 연락, 본가 방문도  1달에 1,2번, 과나 동아리 친구가 딱히 없고 주로 혼밥. (자주 불러내서 같이 밥 먹으면 좋을 듯?, 하루가 반복적인 느낌. 공부-밥-잠.) - 동아리: 논함(토론) 동아리(유령회원), 농구 동아리(탈퇴)  - 좋아하는 운동: 농구와 헬스 - 진로: 아직 꿈에 대해서 명확한 설정이 없음(설비로 갈지, 생산직으로 갈지 등) -> 취업을 준비하면서 자기 객관화가 정말 중요하다고 생각하고 있음. - 철학 같은 거 좋아하는 것 같음. 1학년 때 철학책도 읽으면서     내면 성찰에 대해 관심이 많았음.   공대를 다니고 있는데 인문학 과목이 굉장히 부족하다고 느끼고 있음.   -> 충남대 아고라 광장 끌어서 경석단장님 연결해보기로   - 기타: 전화번호 얻음. 인스타 X. 군대 갔다옴(복학)', 'first_meeting', 24, '24(21학번)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('한지훈', '기계공학교육과', 'ENFJ', '러닝', 0, false, '거주: 신궁동 / - 과생활 열심히 했는데 과 동기들끼리 요즘 잘 안뭉침 - 동아리 : 토익, 러닝 - 취미 : 헬스 러닝 바둑   (바동 계속 신청하는 아이) - 군대는 졸업 후 임용까지 하고 감. - 인스타 없음. - 화수목 저녁 언제든지 괜찮으니 불러달라. 러닝 같이 뛰자.', 'first_meeting', 22, '22(24학번)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('최홍식', '사학과', NULL, '러닝', 0, false, '거주: 긱사 / - 러닝 좋아함. 다른 운동 안좋아함. - 과친구들과 친함.', 'first_meeting', 20, '20(25학번)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('지성민', '경제학과', NULL, '러닝', 0, NULL, '- 군대 다녀옴', 'first_meeting', 23, '23(26학번)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('5eac0047-e061-4702-b5b2-53dcb1b253eb', life_id, 'evangelist') ON CONFLICT DO NOTHING;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('김큰한별', '경제학과', NULL, '러닝', 0, NULL, '- 러닝 시간 안돼서 나감.', 'first_meeting', 20, '20(26학번)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('6d6255a9-9aed-496f-9c5f-bb8c5d209f1b', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '6d6255a9-9aed-496f-9c5f-bb8c5d209f1b', CURRENT_DATE, '(엑셀 데이터)', '- 3/25 : 재하가 따로 러닝 같이 뛰자고 연락해서, 동주형 연결 - 3/31 : 거절당함. 이번 주말은 재하가 안돼서 다음 주말에 가능한지 한번 더 연락해보기.');
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('dab0446a-7f19-4260-b176-7dffb06ca3c4', life_id, 'evangelist') ON CONFLICT DO NOTHING;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('김민기', '신소재공학과', NULL, '러닝', 0, NULL, NULL, 'first_meeting', 25, '25(24학번)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('a8279044-3156-48ba-a108-f7044f5c823c', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, 'a8279044-3156-48ba-a108-f7044f5c823c', CURRENT_DATE, '(엑셀 데이터)', '- 3/25 : 3,4월은 프로젝트로 러닝 어렵다고 함');
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('9d778e37-4b61-4e6a-9974-56370a1686e8', life_id, 'evangelist') ON CONFLICT DO NOTHING;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('이준호', '해양환경과학과', NULL, '러닝', 0, NULL, '거주: 자취(장대동) / - 친구 많이 안사귐 - 러닝 매일 뜀 - 선우 속도 맞춰줌. 착함 - 군대 다녀옴. - 24년도에 편입', 'first_meeting', 25, '25(24학번)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('a8279044-3156-48ba-a108-f7044f5c823c', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, 'a8279044-3156-48ba-a108-f7044f5c823c', CURRENT_DATE, '(엑셀 데이터)', '- 3/25 : 저번주 선우랑 러닝뜀. 이번주는 시간 안돼서 못옴. 다음주 러닝때 경석 만나기. - 3/31 : 저번주 러닝때 이 친구가 못나옴. 오늘 선우가 러닝 같이 하기. 파악해오기.');
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('9d778e37-4b61-4e6a-9974-56370a1686e8', life_id, 'evangelist') ON CONFLICT DO NOTHING;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('권민찬', '의류학과', NULL, '러닝', 0, NULL, '거주: 기숙사 / - 러닝 좋아함. 다른 요일도 뛰고싶다고 함', 'first_meeting', 23, '23(26학번)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('dab0446a-7f19-4260-b176-7dffb06ca3c4', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, 'dab0446a-7f19-4260-b176-7dffb06ca3c4', CURRENT_DATE, '(엑셀 데이터)', '- 3/25 : 러닝 한번 더 뛰기. 파악해오라고 하기.');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('이윤민', '국어국문학과', NULL, '러닝', 0, NULL, '- 착함. 의정이 러닝 처음한다고 하니까 모르는거 물어보라고 하고 엄청 응원해줌', 'first_meeting', NULL, '22학번')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('a8279044-3156-48ba-a108-f7044f5c823c', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, 'a8279044-3156-48ba-a108-f7044f5c823c', CURRENT_DATE, '(엑셀 데이터)', '- 3/25 : 목요일에 만나야 하는데 대특때문에 4/2까지 못만남. 5시 가능한지 물어보기. - 3/31 : 이번주 목요일 5시반에 러닝 진행.');
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('5eac0047-e061-4702-b5b2-53dcb1b253eb', life_id, 'evangelist') ON CONFLICT DO NOTHING;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('정원식', '고고학과', NULL, '러닝', 0, NULL, NULL, 'first_meeting', 23, '23살(26학번)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('a8279044-3156-48ba-a108-f7044f5c823c', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, 'a8279044-3156-48ba-a108-f7044f5c823c', CURRENT_DATE, '(엑셀 데이터)', '- 3/25 : 3월은 러닝 힘들다고 함.');
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('5eac0047-e061-4702-b5b2-53dcb1b253eb', life_id, 'evangelist') ON CONFLICT DO NOTHING;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('임성현', '자율운항시스템공학과', NULL, '러닝', 0, NULL, '- 성격은 좋음. 러닝 페이스 뒤쳐지니 뒤에서 밀어줌. - 러닝 코치해줌', 'first_meeting', 24, '24살(23학번)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('8d1278f1-ea51-4c50-9a4e-82ffc1168e2f', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '8d1278f1-ea51-4c50-9a4e-82ffc1168e2f', CURRENT_DATE, '(엑셀 데이터)', '- 3/25 : 목요일에 만나야 하는데 대특때문에 4/2까지 못만남. 5시 가능한지 물어보기. - 3/31 : 길태우랑 엄청 친해짐. 둘이 동갑, 둘다 공주대에서 왔음.');
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('9d778e37-4b61-4e6a-9974-56370a1686e8', life_id, 'evangelist') ON CONFLICT DO NOTHING;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('길태우', '전기전자통신공학교육과', NULL, '러닝', 0, NULL, NULL, 'first_meeting', 24, '24살(24학번)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('8d1278f1-ea51-4c50-9a4e-82ffc1168e2f', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '8d1278f1-ea51-4c50-9a4e-82ffc1168e2f', CURRENT_DATE, '(엑셀 데이터)', '- 3/25 : 목요일에 만나야 하는데 대특때문에 4/2까지 못만남. 5시 가능한지 물어보기. - 3/31 : 임성현랑 엄청 친해짐. 둘이 동갑, 둘다 공주대에서 왔음.');
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('9d778e37-4b61-4e6a-9974-56370a1686e8', life_id, 'evangelist') ON CONFLICT DO NOTHING;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('김건호', '컴퓨터인공지능학부', NULL, '러닝', 0, NULL, NULL, 'first_meeting', 20, '20살(26학번)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('6d6255a9-9aed-496f-9c5f-bb8c5d209f1b', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '6d6255a9-9aed-496f-9c5f-bb8c5d209f1b', CURRENT_DATE, '(엑셀 데이터)', '- 3/25 : 바로 경석/동주형 연결시키기. 러닝 같이 뛰자고 하기. - 3/31 : 재하가 5시에 뛰자고 해보기. 종교 이성 MBTI 가족친구관계 관심사/고민 파악해오기. 이후 재하가 전초.');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('이민철', '자율운항', NULL, '기타4', 0, NULL, NULL, 'first_meeting', NULL, NULL)
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('a94425e7-f75e-4e4d-98e8-cbb8f4856045', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, 'a94425e7-f75e-4e4d-98e8-cbb8f4856045', CURRENT_DATE, '(엑셀 데이터)', '- 8/16: 남용or재선 연결 말해보기 -9/20: 보류 -1/3 : 강의 2번 들음. 철학적인 얘기는 잘 받아들이지만, 종교에 대한 내용이 나오면 거부감을 느낌. 2월까지 말씀 넣어보고 무신론 안 깨지면 일반회원으로.');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('최진홍', '사학과', 'ISFJ', '우지수', 0, false, '거주: 본가', 'first_meeting', 24, '24살(21학번)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('강호', '농업생물학과', 'INFJ', '우지수', 0, NULL, NULL, 'first_meeting', 21, '21살(24학번)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('임현준', '반도체 융합', 'istp', '신주한', 0, NULL, '거주: 기숙사(당진) / - 버스 타본 적 없음. 긱사에서 반석까지 3시간 걸림', 'first_meeting', 20, '20(26학번)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('5eac0047-e061-4702-b5b2-53dcb1b253eb', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '5eac0047-e061-4702-b5b2-53dcb1b253eb', CURRENT_DATE, '(엑셀 데이터)', '- 3/25 : 의정이가 두쫀쿠 같이 만남. 경석 베이킹으로 연결하려 했으나 당일취소. 이후 일정 잡으려고 시도했으나 있으나 자꾸 뺌. 빵긋 다음 행사때 불러봐야 할듯.');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('박인하', '수학과', NULL, '신주한', 0, NULL, '종교: X / - 수학과 다니고 있는데, 전공을 살린 진로 고민중. - 컴융과 관심이 있음. - 가정국 8기 섭리분 조카.', 'first_meeting', 20, '20(26학번)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('a8279044-3156-48ba-a108-f7044f5c823c', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, 'a8279044-3156-48ba-a108-f7044f5c823c', CURRENT_DATE, '(엑셀 데이터)', '- 3/25 : 경석 선우 같이 만나보기. 토요일 저녁 7시. - 3/31 : 다음에 만나면 바로 전초. 근데 약속 잘 안잡힘..');
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('9d778e37-4b61-4e6a-9974-56370a1686e8', life_id, 'evangelist') ON CONFLICT DO NOTHING;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('박한빈', '농생명융합학부', 'I느낌', '박재현', 0, NULL, '- ai특강때 아이디어가 좋음.  - 착함.', 'first_meeting', 20, '20(26학번)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('9d778e37-4b61-4e6a-9974-56370a1686e8', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '9d778e37-4b61-4e6a-9974-56370a1686e8', CURRENT_DATE, '(엑셀 데이터)', '- 3/30 : 이번주에 치킨 같이먹기. - 3/31 : 의정이랑 카톡방 만듦. 저녁으로 시간대는 확정. 이번주는 수요일밖에 안됨. 이번주 수요일 가능한지 먼저 물어보기.');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('정동희', '사학과', NULL, '소크라테스', 0, NULL, NULL, 'first_meeting', NULL, NULL)
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('a8279044-3156-48ba-a108-f7044f5c823c', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, 'a8279044-3156-48ba-a108-f7044f5c823c', CURRENT_DATE, '(엑셀 데이터)', '- 경석 전초 성공했으나, 애가 별로여서 진행 안하기로 함');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('홍강준', '영어영문학과', 'INFP', '소크라테스', 0, false, '종교: X / 거주: 죽동 자취(제천) / - 내향적인 성격이 고민 - 사람들과 친해지고 싶어서 해오름제 신청함 - 축구 풋살 좋아함 - 외국인 친구 사귀고 싶음', 'first_meeting', 20, '20(26학번)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('a8279044-3156-48ba-a108-f7044f5c823c', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, 'a8279044-3156-48ba-a108-f7044f5c823c', CURRENT_DATE, '(엑셀 데이터)', '- 3/25 : 해오름제 이후에 만나기로 함');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('김영현', '사학과', NULL, '소크라테스', 0, NULL, NULL, 'first_meeting', NULL, NULL)
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('금건웅', '경제학과', NULL, '소크라테스', 0, NULL, '거주: 대전 통학 / - 유교집안 - 독서동아리, 탁구동아리 - 글쓰기, 책 좋아함 - 성경은 언제 기회가 되면 읽어보고 싶다고 함', 'first_meeting', 20, '20(26학번)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('8d1278f1-ea51-4c50-9a4e-82ffc1168e2f', life_id, 'evangelist') ON CONFLICT DO NOTHING;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('최영우', '독어독문학과', 'ESFJ', '이맛저맛', 0, false, '종교: X / 독문과 학생회장. 핵인싸. 풋살 좋아함. 체험단, 지성이랑 연결해줬으나 성향이 안맞는다고 해서 경석이 담당하기로', 'first_meeting', 24, '24세')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('a8279044-3156-48ba-a108-f7044f5c823c', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, 'a8279044-3156-48ba-a108-f7044f5c823c', CURRENT_DATE, '(엑셀 데이터)', '상무초밥 -9/2업: 이번주까지 연락(경석) -9/9업: 21(토) 저녁에 상무초밥 가기로. -9/21업 : 만남. 밥먹고 카페 같이감. 대화 많이하고 번호교환. 10월중에 텐동식당 같이가기로 함. -11/18업 : 마지막 기회 연락 주고 답 없으면 자르기');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('이산', '원예학과', NULL, '이맛저맛', 0, false, '종교: X / 거주: 궁동에서 자취 / 베이킹, 등산좋아한다, 야구좋아한다고 먼저 말 안했는데 말함, 강요하는데 거부감을 느끼는듯. 조만간 둘다 가자고 함. 기독교인들이 오히려 선생님께 무조건 자기 말이 맞다고 무시했다는 식으로 강의하면 좋을듯. 타이틀도 없으니 무시하고.. 다음 강의 벧물, 우리 교회 형부른다고 하면서 재선도사님께 연결', 'first_meeting', 27, '27세(3학년)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('a8279044-3156-48ba-a108-f7044f5c823c', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, 'a8279044-3156-48ba-a108-f7044f5c823c', CURRENT_DATE, '(엑셀 데이터)', '- 3/3: 이번 주 수요일에 만나서 강의 (앞으로 매주 수요일 강의) - 3/10: 저번주 강의 못함. 이번주부터 진행. -3/17: 이번주에 야심작으로 강의함. 잘 들음. 선생님 증거 강력하게 함. 월명동 작품으로 교훈 강의 하고, 월명동 데려가는 것이 목표. 준영이 생명 없으면 산이 진로박람회에 붙어주기. - 3/29: 오늘 전초 시도. 안되면 난 널 만날 이유가 없는 것 같다고 할것.');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('김재현', '메카트로닉스공학', 'intj', '이맛저맛', 0, false, '거주: 월평동 / 일렉에 진심, 밴드부 들어가고 싶어함,  주량 반병, 충대 엄청오고 싶어함 유튜브찾아볼정도, 여동생있음, 많이 놀러다닌적 없음, 청주 태어났지만 대전 토박이', 'first_meeting', 20, '20(25학번)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('성준우', '수학과', 'ISFP', '이맛저맛', 0, false, '종교: x / 거주: 대전 / 진로) 10대 때 친구들이 모르는 문제를 물어보면 풀어주는 것에 큰 재미를 느낌. 그렇게 수학교사로  진로를 정하게 되었는데 점차 흥미가  떨어지고 입시 때 몇몇 공대와 수학과를 지원함. 여기서 수학과를 지원한 이유는  수학교육과 최저를 못 맞춰 수학과에서 교직이수를 할 계획이었으나 충남대에는 교직이수가 없어서 무산됨. 마침 교직에  대한 흥미가 떨어져 2학년 때 공대로 전과할 계획임. 이성관) 경험을 중시하여 대학교에서 많이 사귈 계획임. 술, 담배) 술은 주에 3번은 마심 취미) 애니메이션, 웹툰 취미 확고.  운동 등 몸을 움직이는 것을 싫어함 기타) 공부에 집중하지 않을 것으로 보임 신천지 의심 많음.', 'first_meeting', NULL, '20 25학번')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('박호연', NULL, NULL, '이맛저맛', 0, NULL, NULL, 'first_meeting', 20, '20(25학번)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('a8279044-3156-48ba-a108-f7044f5c823c', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, 'a8279044-3156-48ba-a108-f7044f5c823c', CURRENT_DATE, '(엑셀 데이터)', '-3/10: 이번주 수요일에 만남. -3/17: 진로박람회는 안될듯. 나중에 따로 만나보기. -4/2: 내일 저녁 만남. 전초 바로 시도  -4/16: 강의 2회 진행 -9/9: 9/12 밥먹고 강의듣기로 함. -9/20: 금요일 고정 강의');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('조기은', '스포츠과학과', 'IOOO', '러닝', 0, NULL, '특강옴(지성이가 강하게 당김). 재수했음. 원하는과는 아니라서 반수나 전과 생각있어서 학과애들이랑 안친함 조심하는게 많은 아이임. 2학기에 군대생각하고 있음 (공군) 군대 안되면 또 해보기', 'first_meeting', 21, '21(24학번)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('박성준', '반도체/', 'INFJ', '러닝', 0, NULL, '거주: 용인(현재 중국) / 사람은 괜찮아보임, 다른 맴버랑 더 친함, 군필, 다른대(타지)졸업하고다시입학, 특강옴. 반응 좋고 적극적 기은이랑 오버워치 오픈챗방같이있음. 가족들과 따로 살긴 하지만 사이는 좋아보임(텀블러 선물받은거 여동생 준다고 함) 연락 자주 하는것처럼 보임. 집이 잘 사는 거 같음. 자취방 유지하는거 같음 탁구좋아함/이전에 재웅목사님 러닝특강왔었음', 'first_meeting', 28, '28(24학번)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('a8279044-3156-48ba-a108-f7044f5c823c', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, 'a8279044-3156-48ba-a108-f7044f5c823c', CURRENT_DATE, '(엑셀 데이터)', '-3/10: 오늘 만남. 취업얘기, 주식얘기함. 깊은 파악은 안됐음. 러닝을 4월 초까지 못나옴. -3/17: 진로박람회에는 끌지 않는 것으로 지민와서.');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('양석원', '전자통신교육과', 'INFP', '러닝', 0, NULL, '거주: 기숙사(방학때 본가 감) / 취미] - 운동: 야구, 축구, 배구 등 여러 방면으로 운동을 즐김.  그 중에서 축구, 야구가 주가 되는 느낌. 축구, 야구 경기를 하는 것은 좋아하지 않고, 공을 두고 슈팅하는 등의 정적인 것을 즐김 학과 친구들과 야구장을 갈 생각 중일 정도로 관심 많음.  - 게임: 오버워치, 발로란트, 롤 3가지 게임을 즐김. 친구들과 종종 PC방을 감. 그러나 게임에 전념하는 스타일은 아님. 즐겁게 게임하는 것을 즐김.  특이사항] - 기숙사 생활하지만 룸메가 없음 - 군대를 내년에 갈 계획. - 잔잔하고, 조곤조곤한 말투를 가지고 있음. 공감 잘 해주는 편.', 'first_meeting', NULL, '22학번')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('김민규', '스마트시티건축공', 'INTP', '러닝', 0, NULL, '거주: 세종 / 장발, 특강x, 목표의식X, 자기고집이 있긴함, 수업도쨈. 교회에서 기타 배우고 있음.', 'first_meeting', NULL, '24학번')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('8d1278f1-ea51-4c50-9a4e-82ffc1168e2f', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '8d1278f1-ea51-4c50-9a4e-82ffc1168e2f', CURRENT_DATE, '(엑셀 데이터)', '-3/3: 정천 목사님께 연결 가능. (학교보다는 교회로 생각중) 이번 주 중에 약속 잡기. -3/17: 수요일에 정천 목사님 만남 -4/2: 목사님이 날짜 여쭤보시는데?? 라고 연락하기 -4/16: 정천목사님께  5/10 명동 같이 갈 수 있는지 여쭤보기. 가면 재전초 후 "야 모르겠으면 일단 한번 들어봐" 하면서 확답까지 받기');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('이상민', '경영학부', NULL, '러닝', 0, NULL, '특강옴, 엄청바쁨, 공군의정대나옴, 주4회러닝,학생회, 꿈이 백화점영업관리직, 8시반까지 항상 일정이있음 방학떄 안나오는거같음', 'first_meeting', 24, '24살일듯(20학번)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('정구빈', '바이오시스템기계공학과', 'ESTP', '러닝', 0, false, '종교: X / 거주: 궁동자취(주말엔 원주) / 주말마다 원주에 알바하러 감. 대전에서 해도 되는데 옛날에 다녔던 재수학원이라 정이 들어서 간다고 함. 정이 많은 스타일인듯. 알바시간 : 일 9~18 평일에는 공부 주말에는 알바', 'first_meeting', 27, '27(23학번)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('a8279044-3156-48ba-a108-f7044f5c823c', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, 'a8279044-3156-48ba-a108-f7044f5c823c', CURRENT_DATE, '(엑셀 데이터)', '3/3까지 답장기한. -3/17: 경석이형이 러닝 나오냐고 물어보기');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('김준서(후)', '국토안보학과', NULL, '러닝', 0, true, '거주: 궁동자취(본가 구미) / 성격은 좋지만 군사학부라 이득에 의해서 움직이는 친구같아 보임 여자친구랑 여행다녀옴./외고 나옴(중국어) / 러닝을 주도할 확률이 높아보임 중간에 군입대도 없고', 'first_meeting', 21, '21(23학번)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('박종한', '건축학과', 'ISFJ', '러닝', 0, true, '거주: 세종 / 러닝 2번 왔음.  이상민과 겹치는 지인(친구)가 있음.ㅣ', 'first_meeting', 25, '25(20학번)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('서지훈', '일어일문', NULL, '러닝', 0, true, '야구좋아함, 일본인 여자친구 있음, 마라톤대회도 여러번 나가봄. rotc인거 같음', 'first_meeting', 23, '23(20학번)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('이영호', '경영학부', NULL, '러닝', 0, false, '종교: 기독교 / 거주: 동구 가오동 / 경상대 축구동아리 활동함,축구좋아함. 군대는 공익이라 내년부터 할 예정', 'first_meeting', 20, '20(24학번)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('8d1278f1-ea51-4c50-9a4e-82ffc1168e2f', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '8d1278f1-ea51-4c50-9a4e-82ffc1168e2f', CURRENT_DATE, '(엑셀 데이터)', '-1/27업: 3월 개강 이후에 러닝 나온다고 함. 아직까지 구체적인 연락은 없음. -2/3업: 마라톤 나온다고. -2/17 : 정기런 공지 올라온 후, 다음주 목요일부터 정기런 시작하는데 나오는지 물어보기. -2/24: 지성이에게는 이번학기에도 나온다고 연락옴. 태원이가 내일 다시 연락하기. -3/10: 저번주 러닝 나옴. 관리자 배치는 안함. 최성령과 친구이기 때문. - 개강 후 진행');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('정현수', '경제학과', NULL, '러닝', 0, NULL, '야구동아리 활동, 다른대학 다니다 다시입학 동아리 열심히 하려는 사람   여자얘기 늘 하는편', 'first_meeting', 25, '25(24학번)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('8d1278f1-ea51-4c50-9a4e-82ffc1168e2f', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, '8d1278f1-ea51-4c50-9a4e-82ffc1168e2f', CURRENT_DATE, '(엑셀 데이터)', '-3/10: 저번주 러닝 나옴. -3/17: 태원이가 번호 따기. 목표는 따로 밥먹을수있을 정도로 친해지기 -4/2: 2주간 못만남. 당분간 안나올듯. -4/16: 지민이가 밥먹으면서 생명파악. 이상 없으면 5/10 끌기 - 개강 후 진행 -9/9: 목 러닝 나옴. 러닝할 때는 잘 어울리는데 끝나면 혼자 바로 감. 무리에서 주목받고 싶어하는 느낌이 있음. 얘는 후순위 보류.');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('최성령', '의류학과', 'ISFP', '러닝', 0, NULL, '종교: 기독교  모태 신앙 (청년부 2시  예배 참여) / 거주: 경기도 / -영호와 교양에서 만나서 친해짐. 자신도 신기하게 친해진 경우라고 함. -집에는 자주 안감. 실제로 개강하고 한번도 안갔고, 종강하고 갈 생각이라고 함. 특히 이번학기는 전공 7개를 들음. -옷에 대한 관심이 큼. 창업할 생각도 있음. -일요일에 예배를 간다는 말에 요즘 보기 드문 사람이라고 하니 맞다고 함.', 'first_meeting', 24, '24(21학번)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('김동욱', '수의학과', NULL, '러닝', 0, false, '거주: 성주(본가) 신궁동(자취) / 검도동아리 좋아함(매일 가는 듯). 여자친구 헤어진지 얼마 안되었다고 함. 여행 좋아함.(모르는 사람들과 해외 여행 다가는 프로그램 신천해서 다녀왔다고도 함.)', 'first_meeting', 23, '23(21학번)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('a8279044-3156-48ba-a108-f7044f5c823c', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, 'a8279044-3156-48ba-a108-f7044f5c823c', CURRENT_DATE, '(엑셀 데이터)', '-1/13업: 지난주 3번째 러닝 나옴. 복원이가 관리함.  - 개강 후 진행');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('조재용', '창의융합대학-농생업융학학부', 'INTJ', '러닝', 0, NULL, '거주: 대전 거주(통학) / - 인간관계: 통학이다 보니 부모님과 매일 봄. 과 친구는 적당히 사겼다고 함.  - 진로: 아직 정해진게 없음 - 동아리: RCY 중앙 봉사동아리(쓰레기 치우기, 베이킹)', 'first_meeting', 20, '20(25학번)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('이중엽', '농업생명융합', NULL, '러닝', 0, NULL, '거주: 세종', 'first_meeting', 20, '20(25학번)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('황지환', '인문사회융합학부 (언론정보)', 'INTP', '러닝', 0, NULL, '- 러닝 2기 신규 신청자 - 얼굴 잘생김 - 동아리 4개 : 스쿠버다이빙, 클라이밍 등 - 과생활 안함 - 공익, 어디 다침 - 술 안좋아함', 'first_meeting', 22, '22(25학번)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('이대근', NULL, NULL, '러닝', 0, NULL, NULL, 'first_meeting', NULL, '아예 안나오거나 한두번 나옴')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('유성현(후)', '산림자원학과', NULL, '기타4', 0, true, '유숭열회장님 손자. 자연휴양림 집사님께 연결받음. 말씀 듣기로 이야기가 되어서 연락해보라고 하셨는데 막상 하니 연락 안받음. 군대 신체검사 받은 상황', 'first_meeting', 21, '21세')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('a8279044-3156-48ba-a108-f7044f5c823c', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, 'a8279044-3156-48ba-a108-f7044f5c823c', CURRENT_DATE, '(엑셀 데이터)', '방학때 강원도에 있음. 나중에 휴양림 올때 연락주시면 가보는걸로.');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('오의준', '전자공학과', NULL, '기타4', 0, NULL, '- 꿈에서 맛없는 귤 황성진이랑 나눠먹음 - 일본인 여자친구 있음.', 'first_meeting', NULL, '24.0')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('a8279044-3156-48ba-a108-f7044f5c823c', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, 'a8279044-3156-48ba-a108-f7044f5c823c', CURRENT_DATE, '(엑셀 데이터)', '-1/13업: 크리스마스때 준 부모님이 와서 못끌었음. 성진 준과 밥먹기로 했는데 어떻게 됐는지는 확인 필요.(경석)         -1/27업: 최근에 준이랑 성진이랑 밥을 먹었는데 준이 일본으로 돌아가서 성진과 이야기 할 필요. -2/3업: 성경 배우고 싶다고 함. 이유는 여자친구 교회 다니게 하고 싶어서. 준이 경석 연결해주고 싶다고 함. -2/17 : 후미야가 연결해주기로 함. 아직 연락 안옴. 준에게 물어보겠음. 기도로 분별 동시에 진행. -2/24: 여자친구랑 여행감. 돌아오면 만나기로. -3/3: 이번 주 금요일 만남. -3/10: 말씀듣기로 함. 목요일 이후에 후미야랑 같이 만나야 함. -3/17: 이번주 금(21일)에 후미야랑 만남. 여친 헤어질 것 같다고 후미야가 말함.');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('정재욱', '신소재공학과', 'ISTP', '기타4', 0, false, '종교: 불교(독실) / 거주: 도안동(자취) / - 종교: 독실한 불교(절에 밥 먹듯이 다니는 것은 아니지만, 불교의 종파를 다 알고 있을 정도로 불교지식이 풍부함. 심지어 불교의 한 교파(천태종이었는듯) 에 속해 있음. 그래서 속한 종파가 있는 정읍시의 절에도 가기도 함 기독교를 혐오하거나 하지는 않음 (교회 사람들이 오히려 자신을 싫어할까과 무서워 하는 느낌)  - 인간관계: 본가에 자주 가는 것은 아님. 부모님과 사이는 좋지만 가끔씩 연락. / 고향 친구들과는 계속 연락 유지(초등학교 때부터 찐친. 다들 전역했다고, 자주 술 먹는 파트너) / 과친구는 x. 동아리 친구와 같이 공부하고 밥 먹음.         - 최근의 고민: 1,2학년 때 너무 놀아 성적에 대해 고민이 많음. 따라서 지금 엄청 시험공부 하고 있음 - 동아리: 마술 중앙동아리 - 탁구 엄청 좋아함(경석, 준영과 탁구 파트너) -여행도 좋아함(작년에 리프레쉬로 1차 명동 끌었음, 7월에 친구들과 국토대장정을 떠난다고 함,)  -', 'first_meeting', NULL, '2학년(03년생)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('김은재', '의예과', NULL, '기타4', 0, NULL, '태원 과친구 교회 안좋아함. 무신론 술 안좋아함. 농구 좋아함. 콘서트 태원이랑 가기로.', 'first_meeting', 21, '21(23학번)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('8d1278f1-ea51-4c50-9a4e-82ffc1168e2f', life_id, 'evangelist') ON CONFLICT DO NOTHING;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('임재현', '의예과', NULL, '기타4', 0, NULL, '김은재 유치원 동기 태원 친구', 'first_meeting', 21, '21(24학번)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('8d1278f1-ea51-4c50-9a4e-82ffc1168e2f', life_id, 'evangelist') ON CONFLICT DO NOTHING;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('백대영', '자율운항', NULL, '유민', 0, true, '베이킹생명 의심이 많은 것 같다는 ''느낌''! 파악 필요(경석 단장님) ex) 장소에 대한 궁금증이 계속 있었음.', 'first_meeting', NULL, '24?23?(21학번)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('a8279044-3156-48ba-a108-f7044f5c823c', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, 'a8279044-3156-48ba-a108-f7044f5c823c', CURRENT_DATE, '(엑셀 데이터)', '-2/3업: 경석 준영과 치킨 먹음. 여자친구와 사이 좋음. 내년에 백마인턴십 할수도있음. 2월 남은 방학 기간동안은 어디 놀러도 안가고 집에서 쉬고싶다고 함. 밥먹자고 가끔 부르면 나올듯?  교회 중학교때까지 다녔는데 지금은 안다님. 왜 안다니냐고 물어봤는데 성경의 의문들 몇개 물어보길래 대답해줌. 영적체험 얘기도 해줌. -2/10업: 다시 만나자고 하는 것도 어색한 사이인 것 같음. 그러나 베이킹(멜로우)하면 온다고 해서 할 예정. 급하게 월명동 데려갈 필요 없다고 느낌(경석, 설희 단장님) -2/24: 생일 축하 연락함. 생일밥 사준다 핑계로 한번 만나기');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('김기민', '창의융합대학(인공지능학과)', 'INFP', '유민', 0, NULL, '거주: 대전X', 'first_meeting', 20, '20(25학번)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('나하윤', '창의융합대학(--학과)', 'INFJ', '유민', 0, NULL, '거주: 대전X / - 배드민턴 좋아함. 야구를 더 좋아해서 야구동아리도 들어감.', 'first_meeting', 21, '21(25학번)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('성원빈', '자율운항', NULL, '유민', 0, NULL, NULL, 'first_meeting', NULL, NULL)
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('a94425e7-f75e-4e4d-98e8-cbb8f4856045', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, 'a94425e7-f75e-4e4d-98e8-cbb8f4856045', CURRENT_DATE, '(엑셀 데이터)', '- 8/16: 남용or재선 연결 말해보기 -9/9: 재선 바쁨. 동주 물어보기. 오늘 경석. -9/20: 부교역자님 연결하면 어떤가?');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('박선우', '응용생물', 'INFP', '우지수', 0, true, '- 과생활 열심히 했으나, 지금은 동기 거의 없음 - CR(봉사동아리) - 취미 : 롤, 헬스 - 배구 교양 생명, 배구 좋아하진 않지만 운동신경 좋음', 'first_meeting', NULL, '(20학번)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('송민준', '컴퓨터융합학과', 'enfp', '논알콜파티1', 0, false, '종교: X (할머니가 교회 나가지 말라고 하는 편) / 거주: 전주 / 여친없음, 남고, 예체능은 별로 좋아하지 않는다고함. 장손이라서 집에서 관심이 많은편. 과대.', 'first_meeting', 20, '20세(25학번)')
RETURNING id INTO life_id;

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('임준형', '물리학과', 'INFJ', '풋살2', 0, false, '종교: x / 거주: 상주 / 착함. 고향친구랑 1년에 2번정도 만남. 검정고시로 학교 옴.', 'first_meeting', 26, '26세(24학번)')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('a8279044-3156-48ba-a108-f7044f5c823c', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, 'a8279044-3156-48ba-a108-f7044f5c823c', CURRENT_DATE, '(엑셀 데이터)', '-4/2: 경석단장님이 전초 할예정. 홈스쿨링/신앙 파악 필요. 경석 지민과 밥먹고 바로 전초. -8/16: 강의 듣는 중 -9/9: 중심인물론 강의때 선생님 중심인물이라고 밝힘. -9/16: 이번주 예배 옴. 9/27 행사 끌어보기.');

INSERT INTO lives (name, department, mbti, meeting_reason, meeting_count, has_partner, characteristics, stage, age, student_id_number)
VALUES ('이승주', '기계공', NULL, '풋살2', 0, NULL, '거주: 김천, 자취 / 착함. 고향친구랑 1년에 2번정도 만남. 검정고시로 학교 옴. 경석단장이 인스타받음', 'first_meeting', NULL, '02년생')
RETURNING id INTO life_id;
INSERT INTO user_lives (user_id, life_id, role_in_life) VALUES ('f552f58d-0b8d-43de-a138-5fbeaef363c0', life_id, 'evangelist') ON CONFLICT DO NOTHING;
INSERT INTO journals (life_id, author_id, met_date, location, response) VALUES (life_id, 'f552f58d-0b8d-43de-a138-5fbeaef363c0', CURRENT_DATE, '(엑셀 데이터)', '-4/2: 밥을 같이 먹은 선배가 도정이가 처음. 경석단장님이 시험 후 전초할 예정 -4/16: 도정이가 5/10 끌어봐도 좋을듯?? -8/16: 강의 듣는 중 -9/9: 최근에 강의 진행 안되는듯. -9/20: 잠시 보류중.  마음 힘들다고 들어서, 자연 속에 힐링하러 가자? -11/29: 크리스마스 행사 끌어보기');
END $$;