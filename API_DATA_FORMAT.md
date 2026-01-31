# API Data Format Specification

## Overview

이 문서는 HY-Table 백엔드 API의 프론트엔드와 백엔드 간 데이터 교환 형식을 명시합니다.

---

## 1. POST /api/parse-condition

### 프론트엔드 → 백엔드 (Request)

**Endpoint**: `POST /api/parse-condition`

**Request Body**:
```json
{
  "input": "월요일 7-9시 안 됨. 오전 수업은 피하고 싶어요.",
  "currentConditions": [
    {
      "id": "condition_1",
      "type": "시간 제약",
      "label": "월요일 09:00-10:00 불가",
      "value": "blocked_MON_0900_1000"
    }
  ]
}
```

**필드 설명**:
- `input` (string, required): 사용자가 입력한 한국어 자연어 텍스트
- `currentConditions` (array, optional): 현재 설정된 조건 목록
  - `id` (string, optional): 조건 고유 ID
  - `type` (string): 조건 타입 ("시간 제약", "공강 설정", "수업 성향", 등)
  - `label` (string): 사용자에게 표시될 라벨
  - `value` (string | boolean | number): 조건 값

**예시 입력 텍스트**:
- `"월요일 7-9시 안 됨"`
- `"오전 수업은 피하고 싶어요"`
- `"점심시간 12~1시는 항상 비워주세요"`
- `"팀플 많은 과목은 싫어요"`
- `"하루에 수업은 3개 이하였으면 좋겠어요"`

### 백엔드 → 프론트엔드 (Response)

**Success Response (200 OK)**:
```json
{
  "conditions": [
    {
      "type": "시간 제약",
      "label": "월요일 07:00-09:00 불가",
      "value": "blocked_MON_0700_0900"
    },
    {
      "type": "시간 제약",
      "label": "오전 수업 피하기",
      "value": "avoidMorning_true"
    },
    {
      "type": "공강 설정",
      "label": "월요일 공강",
      "value": "avoidDays_MON"
    }
  ]
}
```

**Error Response (400/500)**:
```json
{
  "ok": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid request data",
    "details": [
      {
        "path": ["input"],
        "message": "Input is required"
      }
    ]
  }
}
```

**조건 타입 (type) 종류**:
- `"시간 제약"`: 특정 시간대 불가
- `"공강 설정"`: 특정 요일 공강
- `"수업 성향"`: 수업 성향 관련 (팀플, 온라인 등)
- `"목표학점 설정"`: 목표 학점 범위

**value 형식**:
- 시간 제약: `"blocked_{DAY}_{STARTTIME}_{ENDTIME}"`
  - 예: `"blocked_MON_0700_0900"` (월요일 07:00-09:00 불가)
  - 예: `"blocked_WED_1800_1900"` (수요일 18:00-19:00 불가)
- 공강 설정: `"avoidDays_{DAY}"`
  - 예: `"avoidDays_MON"` (월요일 공강)
- 시간 제약 (오전): `"avoidMorning_true"`
- 시간 제약 (점심): `"keepLunchTime_true"`
- 수업 성향: `"avoidTeamProjects_true"`, `"preferOnlineClasses_true"`

---

## 2. POST /api/recommend

### 프론트엔드 → 백엔드 (Request)

**Endpoint**: `POST /api/recommend`

**Request Body**:
```json
{
  "user": {
    "name": "홍길동",
    "major": "컴퓨터공학",
    "studentIdYear": 25,
    "grade": 2,
    "semester": 1
  },
  "targetCredits": 15,
  "fixedLectures": [
    {
      "name": "데이터베이스",
      "code": "CSE2003",
      "credits": 3,
      "day": 0,
      "startHour": 2,
      "duration": 2,
      "professor": "김교수"
    }
  ],
  "blockedTimes": [
    {
      "day": 2,
      "start": 0,
      "end": 13,
      "label": "수요일 공강"
    },
    {
      "day": 0,
      "start": 7,
      "end": 9,
      "label": "월요일 7-9시 불가"
    }
  ],
  "constraints": {
    "학업 목표": false,
    "시간 제약": "blocked_MON_0700_0900",
    "선호 과목": false,
    "수업 성향": false,
    "공강 설정": "avoidDays_WED",
    "목표학점 설정": "15~18",
    "강의담기": false,
    "장바구니": false
  },
  "freeTextRequest": "월요일 7-9시 안 됨. 오전 수업은 피하고 싶어요.",
  "strategy": "MAJOR_FOCUS",
  "tracks": ["소프트웨어", "인공지능"],
  "interests": ["머신러닝", "웹개발"]
}
```

**필드 설명**:

#### user (object, required)
- `name` (string): 사용자 이름
- `major` (string): 전공
- `studentIdYear` (number): 학번 연도 (예: 25)
- `grade` (number): 학년 (1-4)
- `semester` (number): 학기 (1-2)

#### targetCredits (number | string, required)
- 목표 학점
- 숫자: `15`
- 문자열 (범위): `"15~18"` → 최소값(15) 사용

#### fixedLectures (array, optional, default: [])
- 확정 강의 (HARD 제약)
- 각 항목:
  - `name` (string): 강의명
  - `code` (string): 강의코드
  - `credits` (number): 학점
  - `day` (number): 요일 (0=월, 1=화, 2=수, 3=목, 4=금, 5=토)
  - `startHour` (number): 시작 시간 (0=09:00, 1=10:00, ..., 13=22:00)
  - `duration` (number): 수업 시간 (30분 단위: 2=1시간, 3=1.5시간, 4=2시간)
  - `professor` (string, optional): 교수명

#### blockedTimes (array, optional, default: [])
- 절대 불가능한 시간 (HARD 제약)
- 각 항목:
  - `day` (number): 요일 (0=월, 1=화, 2=수, 3=목, 4=금, 5=토)
  - `start` (number): 시작 시간 (0=09:00, 1=10:00, ..., 13=22:00)
  - `end` (number): 종료 시간 (0=09:00, 1=10:00, ..., 13=22:00)
  - `label` (string, optional): 라벨 (예: "수요일 공강", "월요일 7-9시 불가")

**시간 인코딩**:
- `day`: 0=월요일, 1=화요일, 2=수요일, 3=목요일, 4=금요일, 5=토요일
- `start`/`end`: 0=09:00, 1=10:00, 2=11:00, ..., 13=22:00
- 예: 월요일 7-9시 → `{ day: 0, start: -2, end: 0 }` (7시는 09:00 기준 -2)
- 예: 월요일 18-19시 → `{ day: 0, start: 9, end: 10 }` (18시는 09:00 기준 +9)

#### constraints (object, optional, default: {})
- 선호 조건 (SOFT 제약)
- 키: 조건 타입 ("학업 목표", "시간 제약", "선호 과목", 등)
- 값: `string | false`
  - `false`: 조건 비활성화
  - `string`: 조건 값
    - 예: `"blocked_MON_0700_0900"` (시간 제약)
    - 예: `"avoidDays_WED"` (공강 설정)
    - 예: `"15~18"` (목표학점 설정)

#### freeTextRequest (string, optional)
- 사용자 입력 원문 (한국어 자연어)
- 예: `"월요일 7-9시 안 됨. 오전 수업은 피하고 싶어요."`

#### strategy (enum, optional, default: "MIX")
- `"MAJOR_FOCUS"`: 전공 중심
- `"MIX"`: 균형잡힌
- `"INTEREST_FOCUS"`: 관심사 중심

#### tracks (array, optional, default: [])
- 전공 트랙 목록
- 예: `["소프트웨어", "인공지능"]`

#### interests (array, optional, default: [])
- 관심사 목록
- 예: `["머신러닝", "웹개발"]`

### 백엔드 → 프론트엔드 (Response)

**Success Response (200 OK)**:
```json
{
  "recommendations": [
    {
      "rank": 1,
      "totalCredits": 15,
      "score": 145,
      "explanation": "목표 학점(15학점)을 달성했습니다. 균형잡힌 시간표입니다.",
      "warnings": [],
      "courses": [
        {
          "id": "CSE2001",
          "name": "데이터베이스",
          "code": "CSE2001",
          "credits": 3,
          "professor": "김교수",
          "type": "OFFLINE",
          "day": 0,
          "startHour": 9,
          "duration": 2,
          "color": "#FFB3BA"
        }
      ]
    }
  ],
  "debug": {
    "candidatesGenerated": 50,
    "geminiUsed": true,
    "executionTime": 2
  }
}
```

**Error Response (400/500)**:
```json
{
  "ok": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid request data",
    "details": [
      {
        "path": ["user", "name"],
        "message": "Required"
      }
    ]
  }
}
```

또는 HARD 제약 충돌 시:
```json
{
  "error": "HARD 제약 조건 충돌",
  "details": {
    "reason": "고정 강의와 차단 시간이 충돌합니다.",
    "conflictingConstraints": ["시간 제약", "공강 설정"],
    "suggestions": [
      "목표 학점을 15로 낮추기",
      "수업 성향 조건을 해제하기"
    ]
  }
}
```

**recommendations 배열 항목**:
- `rank` (number): 순위 (1부터 시작)
- `totalCredits` (number): 총 학점
- `score` (number): 점수 (높을수록 좋음)
- `explanation` (string): 설명 (한국어 1-2문장)
- `warnings` (array): 경고 메시지 배열
- `courses` (array): 강의 목록
  - `id` (string): 강의 ID
  - `name` (string): 강의명
  - `code` (string): 강의코드
  - `credits` (number): 학점
  - `professor` (string): 교수명
  - `type` (string): 수업 방식 ("ONLINE", "OFFLINE", "HYBRID")
  - `day` (number): 요일 (0=월, 1=화, ..., 5=토)
  - `startHour` (number): 시작 시간 (0=09:00, 1=10:00, ..., 13=22:00)
  - `duration` (number): 수업 시간 (시간 단위)
  - `color` (string): 색상 HEX 코드

---

## 3. GET /api/courses

### 프론트엔드 → 백엔드 (Request)

**Endpoint**: `GET /api/courses?major=컴퓨터공학&q=알고리즘`

**Query Parameters**:
- `major` (string, optional): 전공 필터
- `q` (string, optional): 검색어

### 백엔드 → 프론트엔드 (Response)

**Success Response (200 OK)**:
```json
{
  "courses": [
    {
      "courseId": "CSE2001",
      "name": "데이터베이스",
      "credits": 3,
      "major": "컴퓨터공학",
      "category": "전공필수",
      "tags": ["프로그래밍", "자료구조"],
      "meetingTimes": [
        {
          "day": "MON",
          "startTime": "09:00",
          "endTime": "10:30"
        }
      ],
      "deliveryType": "OFFLINE",
      "instructor": "김교수"
    }
  ],
  "count": 1
}
```

---

## 4. Notes 필드 파싱 규칙

### 지원하는 형식

백엔드는 `notes` 필드에서 다음 형식을 파싱합니다:

1. **HH:MM-HH:MM 형식**:
   - `"월요일 18:00-19:00 알바"`
   - `"MON 18:00-19:00 unavailable"`
   - `"월 7:00-9:00"`

2. **N-N시 형식** (새로 추가):
   - `"월요일 7-9시 안 됨"`
   - `"수요일 18-19시"`
   - `"월 7-9시"`

### 파싱 결과

위 형식이 파싱되면 프론트엔드에 다음과 같이 전달됩니다:

```json
{
  "conditions": [
    {
      "type": "시간 제약",
      "label": "월요일 07:00-09:00 불가",
      "value": "blocked_MON_0700_0900"
    }
  ]
}
```

### 프론트엔드에서 사용

프론트엔드는 `value` 필드를 사용하여 `blockedTimes` 배열에 추가할 수 있습니다:

```typescript
// value: "blocked_MON_0700_0900"를 파싱
const parts = value.split('_'); // ["blocked", "MON", "0700", "0900"]
const day = parts[1]; // "MON"
const startTime = parts[2]; // "0700"
const endTime = parts[3]; // "0900"

// day를 숫자로 변환 (MON=0, TUE=1, ...)
const dayNumber = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].indexOf(day);

// 시간을 숫자로 변환 (07:00 → 7, 09:00 → 9)
// startHour: 09:00 기준으로 계산 (7시는 -2, 9시는 0)
const startHour = parseInt(startTime.substring(0, 2), 10) - 9;
const endHour = parseInt(endTime.substring(0, 2), 10) - 9;

// blockedTimes에 추가
blockedTimes.push({
  day: dayNumber,
  start: startHour,
  end: endHour,
  label: label // "월요일 07:00-09:00 불가"
});
```

---

## 5. 에러 응답 형식

모든 에러는 다음 형식을 따릅니다:

```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description",
    "details": {} // Optional
  }
}
```

**에러 코드 종류**:
- `BAD_REQUEST`: 잘못된 요청 (400)
- `NOT_FOUND`: 리소스를 찾을 수 없음 (404)
- `INTERNAL_SERVER_ERROR`: 서버 내부 오류 (500)
- `JSON_SERIALIZATION_ERROR`: JSON 직렬화 오류 (500)

---

## 6. 데이터 타입 참고

### 요일 인코딩
- 숫자: `0`=월요일, `1`=화요일, `2`=수요일, `3`=목요일, `4`=금요일, `5`=토요일
- 문자열: `"MON"`, `"TUE"`, `"WED"`, `"THU"`, `"FRI"`, `"SAT"`

### 시간 인코딩
- `startHour`/`end`: `0`=09:00, `1`=10:00, `2`=11:00, ..., `13`=22:00
- 실제 시간 계산: `실제시간 = 9 + startHour`
- 예: `startHour: 0` → 09:00, `startHour: 9` → 18:00

### duration 인코딩
- `2` = 1시간
- `3` = 1.5시간
- `4` = 2시간
- 일반식: `실제시간(시간) = duration / 2`

---

## 7. 예시 시나리오

### 시나리오 1: 사용자가 "월요일 7-9시 안 됨" 입력

1. **프론트엔드 → 백엔드** (`POST /api/parse-condition`):
```json
{
  "input": "월요일 7-9시 안 됨"
}
```

2. **백엔드 → 프론트엔드**:
```json
{
  "conditions": [
    {
      "type": "시간 제약",
      "label": "월요일 07:00-09:00 불가",
      "value": "blocked_MON_0700_0900"
    }
  ]
}
```

3. **프론트엔드가 blockedTimes에 추가**:
```json
{
  "blockedTimes": [
    {
      "day": 0,
      "start": -2,
      "end": 0,
      "label": "월요일 07:00-09:00 불가"
    }
  ]
}
```

4. **프론트엔드 → 백엔드** (`POST /api/recommend`):
```json
{
  "blockedTimes": [
    {
      "day": 0,
      "start": -2,
      "end": 0,
      "label": "월요일 07:00-09:00 불가"
    }
  ],
  "constraints": {
    "시간 제약": "blocked_MON_0700_0900"
  }
}
```

---

## 8. 주의사항

1. **HARD vs SOFT 제약**:
   - `fixedLectures`, `blockedTimes`: HARD 제약 (절대 조건)
   - `constraints`: SOFT 제약 (선호 조건, 점수에만 영향)

2. **시간 범위**:
   - `startHour`/`end`는 0-13 범위 (09:00-22:00)
   - 7-9시 같은 경우는 `-2`~`0`으로 인코딩 (09:00 기준)

3. **JSON 직렬화**:
   - 모든 응답은 유효한 JSON을 보장
   - JSON 파싱 에러가 발생하지 않도록 처리됨

4. **에러 처리**:
   - 모든 에러는 `{ ok: false, error: {...} }` 형식
   - 프론트엔드는 `ok` 필드로 성공/실패 판단
