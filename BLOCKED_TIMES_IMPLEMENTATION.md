# BlockedTimes 기능 구현 완료

## 수정/추가된 파일 목록

1. `src/types/index.ts` - 타입 정의 수정
2. `src/routes/recommend.ts` - 검증 및 디버그 정보 추가
3. `src/services/schedulerService.ts` - 디버그 정보 반환 추가
4. `src/utils/timeParser.ts` - 검증 및 겹침 판정 함수 추가

## 주요 변경 사항

### 1. 타입 정의 (`src/types/index.ts`)

```typescript
export interface BlockedTime {
  day: DayOfWeek;
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  label?: string; // Optional label (e.g., "알바", "동아리")
}

export interface RecommendationResponse {
  // ... existing fields ...
  debug: {
    candidatesGenerated: number;
    geminiUsed: boolean;
    blockedTimesApplied?: boolean;
    blockedTimesCount?: number;
    combinationsFilteredByBlockedTimes?: number;
  };
}
```

### 2. 검증 강화 (`src/routes/recommend.ts`)

- `blockedTimes` 배열의 각 요소 검증:
  - `day`: 한국어 요일 또는 영문 요일 형식 검증
  - `start`/`end` 또는 `startTime`/`endTime` 또는 `startHour`/`duration` 형식 지원
  - 시간 형식 검증 (HH:MM, 24시간 형식)
  - `start < end` 검증
- 검증 실패 시 400 에러 반환:
  ```json
  {
    "error": "VALIDATION_ERROR",
    "message": "Invalid blockedTimes data",
    "details": [
      {
        "index": 0,
        "message": "Invalid start time format: \"25:00\". Expected HH:MM format (e.g., \"18:00\")"
      }
    ]
  }
  ```

### 3. 시간 파싱/겹침 판정 유틸 (`src/utils/timeParser.ts`)

추가된 함수:
- `isValidTimeFormat(timeStr: string): boolean` - HH:MM 형식 검증
- `isValidTimeRange(startTime: string, endTime: string): boolean` - start < end 검증
- `overlapsWithBlockedTime(slot: TimeSlot, blockedTime: BlockedTime): boolean` - 겹침 판정

### 4. 추천 로직 적용 (`src/services/schedulerService.ts`)

- `filterValidCourses`에서 이미 `blockedTimes`와 겹치는 강의를 필터링
- 겹침 조건: `(classStart < blockEnd) && (classEnd > blockStart)` (같은 요일일 때)
- 필터링된 강의 수를 디버그 정보로 반환

### 5. 응답 디버그 정보 (`src/routes/recommend.ts`)

응답에 다음 디버그 정보 추가:
```json
{
  "recommendations": [...],
  "debug": {
    "candidatesGenerated": 15,
    "geminiUsed": false,
    "blockedTimesApplied": true,
    "blockedTimesCount": 2,
    "combinationsFilteredByBlockedTimes": 8
  }
}
```

## 테스트 예시

### 예시 1: 화요일 18:00-21:00 알바

**Request:**
```json
{
  "basket": [
    {
      "title": "자료구조",
      "professor": "김교수",
      "code": "CSE2010",
      "credits": 3,
      "day": "월",
      "startHour": 9,
      "duration": 2
    }
  ],
  "blockedTimes": [
    {
      "day": "화",
      "start": "18:00",
      "end": "21:00",
      "label": "알바"
    }
  ],
  "strategy": "MIX",
  "tracks": [],
  "interests": [],
  "constraints": {},
  "freeTextRequest": ""
}
```

**동작 설명:**
- 화요일 18:00-21:00 시간대에 강의가 있는 모든 조합이 제외됩니다.
- 예: "화요일 17:00-19:00" 강의는 겹치므로 제외
- 예: "화요일 15:00-17:00" 강의는 겹치지 않으므로 포함 가능
- 예: "수요일 18:00-21:00" 강의는 다른 요일이므로 포함 가능

### 예시 2: 여러 blockedTimes

**Request:**
```json
{
  "basket": [],
  "blockedTimes": [
    {
      "day": "월",
      "start": "09:00",
      "end": "12:00",
      "label": "동아리"
    },
    {
      "day": "수",
      "start": "14:00",
      "end": "16:00",
      "label": "알바"
    },
    {
      "day": "금",
      "start": "18:00",
      "end": "20:00",
      "label": "과외"
    }
  ],
  "strategy": "MIX",
  "tracks": [],
  "interests": [],
  "constraints": {},
  "freeTextRequest": ""
}
```

**동작 설명:**
- 월요일 09:00-12:00, 수요일 14:00-16:00, 금요일 18:00-20:00 시간대에 강의가 있는 조합이 모두 제외됩니다.

### 예시 3: 다양한 입력 형식 지원

**Request (start/end 형식):**
```json
{
  "blockedTimes": [
    {
      "day": "화",
      "start": "18:00",
      "end": "21:00"
    }
  ]
}
```

**Request (startTime/endTime 형식):**
```json
{
  "blockedTimes": [
    {
      "day": "화",
      "startTime": "18:00",
      "endTime": "21:00"
    }
  ]
}
```

**Request (startHour/duration 형식):**
```json
{
  "blockedTimes": [
    {
      "day": "화",
      "startHour": 18,
      "duration": 3
    }
  ]
}
```

### 예시 4: 검증 에러 케이스

**Request (잘못된 시간 형식):**
```json
{
  "blockedTimes": [
    {
      "day": "화",
      "start": "25:00",
      "end": "21:00"
    }
  ]
}
```

**Response (400):**
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid blockedTimes data",
  "details": [
    {
      "index": 0,
      "message": "Invalid start time format: \"25:00\". Expected HH:MM format (e.g., \"18:00\")"
    }
  ]
}
```

**Request (start > end):**
```json
{
  "blockedTimes": [
    {
      "day": "화",
      "start": "21:00",
      "end": "18:00"
    }
  ]
}
```

**Response (400):**
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid blockedTimes data",
  "details": [
    {
      "index": 0,
      "message": "Invalid time range: start time \"21:00\" must be before end time \"18:00\""
    }
  ]
}
```

## 구현 세부사항

### 겹침 판정 로직

```typescript
// timeSlotsOverlap 함수 사용
// 조건: (classStart < blockEnd) && (classEnd > blockStart) && (same day)
```

### 필터링 시점

- **조합 생성 전 필터링**: `filterValidCourses`에서 개별 강의가 `blockedTimes`와 겹치면 후보에서 제거
- 이 방식이 더 효율적: 조합 생성 전에 미리 제거하여 불필요한 조합 생성 방지

### 성능 고려사항

- `blockedTimes`가 비어있으면 기존 로직과 100% 동일한 동작 (추가 오버헤드 없음)
- 필터링은 O(n*m) 복잡도 (n: 강의 수, m: blockedTimes 수)
- 실제 사용 시 `blockedTimes`는 보통 1-5개 정도로 제한적이므로 성능 영향 미미

## 주의사항

1. `label` 필드는 서버에서 사용하지 않지만, 들어와도 깨지지 않도록 허용
2. `blockedTimes`가 없거나 빈 배열이면 기존 로직과 동일 동작
3. 모든 에러 응답은 `res.status(...).json(...)` 형태로 JSON 반환
4. 프론트엔드가 `debug` 필드를 무시해도 동작에 문제 없음
