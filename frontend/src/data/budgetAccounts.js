// 표준 교회 예산과목 체계 (관/항/목) — reference/1-1. 제110회 재정세미나자료집 PDF 기준
// 관(10단위) - 항(100단위) - 목(1000단위) 3단계 구조.
// 여기 목(leaf) 단위로 예산서입력 화면에서 당기예산을 입력하고,
// budget_categories 테이블에 "코드 명" 형태의 name으로 저장한다.

export const INCOME_ACCOUNTS = [
  {
    code: '11', name: '주일헌금',
    items: [
      { code: '111', name: '십일조헌금' },
      { code: '112', name: '일반주정헌금' },
      { code: '113', name: '월정헌금' },
      { code: '114', name: '주일헌금' },
      { code: '115', name: '교회학교헌금' },
      { code: '116', name: '감사헌금' },
    ],
  },
  {
    code: '12', name: '절기헌금',
    items: [
      { code: '121', name: '부활절헌금' },
      { code: '122', name: '맥추절헌금' },
      { code: '123', name: '추수감사절헌금' },
      { code: '124', name: '성탄절헌금' },
    ],
  },
  {
    code: '13', name: '목적헌금',
    items: [
      { code: '131', name: '선교헌금' },
      { code: '132', name: '장학헌금' },
      { code: '133', name: '부흥회헌금' },
    ],
  },
  {
    code: '14', name: '과년도수입',
    items: [
      { code: '141', name: '과년도수입' },
    ],
  },
  {
    code: '15', name: '잡수입',
    items: [
      { code: '151', name: '수입이자' },
      { code: '152', name: '기타잡수입' },
    ],
  },
  {
    code: '21', name: '자본수입',
    items: [
      { code: '211', name: '일시차입금' },
      { code: '212', name: '차입금' },
      { code: '213', name: '적립금인출' },
      { code: '214', name: '자산처분수입(기본금)' },
      { code: '215', name: '건축헌금(기본금)' },
      { code: '216', name: '미수금' },
    ],
  },
]

export const EXPENSE_ACCOUNTS = [
  {
    code: '10', name: '사업비',
    items: [], // 하위 항(110~114)으로만 구성
    groups: [
      {
        code: '110', name: '인건비',
        items: [
          { code: '1101', name: '교역자 생활비' },
          { code: '1102', name: '직원급여' },
          { code: '1103', name: '상여금' },
          { code: '1104', name: '기타수당' },
          { code: '1105', name: '강사료' },
          { code: '1106', name: '연금및의보' },
        ],
      },
      {
        code: '111', name: '예배비',
        items: [
          { code: '1111', name: '예배환경비' },
          { code: '1112', name: '목회연구비' },
          { code: '1113', name: '주보대' },
          { code: '1114', name: '성가대' },
          { code: '1115', name: '교회음악활동비' },
        ],
      },
      {
        code: '112', name: '선교비',
        items: [
          { code: '1121', name: '전도비' },
          { code: '1122', name: '국내선교비' },
          { code: '1123', name: '해외선교비' },
          { code: '1124', name: '사회선교비' },
          { code: '1125', name: '심방비' },
        ],
      },
      {
        code: '113', name: '교육비',
        items: [
          { code: '1131', name: '교육훈련비' },
          { code: '1132', name: '교육활동비' },
          { code: '1133', name: '장학금' },
          { code: '1134', name: '도서비' },
        ],
      },
      {
        code: '114', name: '봉사비',
        items: [
          { code: '1141', name: '경조비' },
          { code: '1142', name: '구호비' },
          { code: '1143', name: '지역사회봉사비' },
          { code: '1144', name: '행사비' },
          { code: '1145', name: '친교비' },
        ],
      },
    ],
  },
  {
    code: '12', name: '운영관리비',
    items: [],
    groups: [
      {
        code: '120', name: '관리비',
        items: [
          { code: '1201', name: '사택관리비' },
          { code: '1202', name: '수도광열비' },
          { code: '1203', name: '공과금' },
          { code: '1204', name: '차량유지비' },
          { code: '1205', name: '교회미화비' },
          { code: '1206', name: '수선유지비' },
        ],
      },
      {
        code: '121', name: '운영비',
        items: [
          { code: '1211', name: '목회활동비' },
          { code: '1212', name: '통신비' },
          { code: '1213', name: '도서인쇄비' },
          { code: '1214', name: '회의비' },
          { code: '1215', name: '연료비' },
          { code: '1216', name: '홍보비' },
          { code: '1217', name: '사무비' },
          { code: '1218', name: '출판비' },
          { code: '1219', name: '잡비' },
        ],
      },
    ],
  },
  {
    code: '13', name: '상회비',
    items: [
      { code: '1301', name: '상회비' },
    ],
  },
  {
    code: '14', name: '기타비용',
    items: [
      { code: '1401', name: '지급이자' },
      { code: '1402', name: '건물임차료' },
    ],
  },
  {
    code: '15', name: '예비비',
    items: [
      { code: '1501', name: '예비비' },
    ],
  },
  {
    code: '20', name: '자본지출',
    items: [
      { code: '211', name: '토지' },
      { code: '212', name: '건물' },
      { code: '213', name: '비품' },
      { code: '214', name: '차량' },
      { code: '215', name: '제적립예금' },
      { code: '216', name: '가지급금' },
      { code: '217', name: '차입금반환' },
    ],
  },
]
