# 프론트엔드 업데이트 안내

## 📢 중요 변경사항

백엔드의 `notes` 필드 파싱 로직이 개선되어 **영어 형식(AM/PM)도 지원**합니다.

### 변경 전
- 한국어 형식만 파싱 가능: `"월요일 7-9시 알바"`, `"월요일 18:00-19:00"`
- 영어 형식 파싱 불가: `"Monday 3 PM - 8 PM"` ❌

### 변경 후
- 한국어 형식: `"월요일 7-9시 알바"`, `"월요일 18:00-19:00"` ✅
- 영어 형식: `"Monday 3 PM - 8 PM"`, `"MON 3 PM - 8 PM"` ✅
- **이유 텍스트는 무시되고 시간 정보만 추출됩니다**

---

## 🔑 핵심 포인트

### 1. 동일한 시간대는 동일한 value로 저장

**이유와 무관하게 같은 시간대면 같은 `value`가 생성됩니다:**

```javascript
// 다음 모두 동일한 value를 생성합니다:
"월요일 3-8시 알바"           → "blocked_MON_1500_2000"
"Monday 3 PM - 8 PM 알바"    → "blocked_MON_1500_2000"
"월요일 15:00-20:00 불가"     → "blocked_MON_1500_2000"
"MON 3 PM - 8 PM part-time"  → "blocked_MON_1500_2000"
```

**프론트엔드에서는 중복 체크가 필요할 수 있습니다.**

---

## 📋 API 응답 형식 (변경 없음)

### POST /api/parse-condition Response

```json
{
  "conditions": [
    {
      "type": "시간 제약",
      "label": "월요일 15:00-20:00 불가",
      "value": "blocked_MON_1500_2000"
    }
  ]
}
```

**형식은 동일하며, 영어 입력도 동일한 형식으로 변환됩니다.**

---

## 🔄 프론트엔드 처리 방법

### 1. 중복 체크 (권장)

같은 시간대가 여러 번 추가되지 않도록 체크:

```typescript
// conditions 배열에서 중복 제거
const uniqueConditions = conditions.reduce((acc, condition) => {
  // value로 중복 체크
  if (!acc.find(c => c.value === condition.value)) {
    acc.push(condition);
  }
  return acc;
}, [] as typeof conditions);
```

### 2. blockedTimes 변환

`value`를 파싱하여 `blockedTimes` 배열에 추가:

```typescript
function parseBlockedTimeValue(value: string) {
  // value: "blocked_MON_1500_2000"
  const parts = value.split('_'); // ["blocked", "MON", "1500", "2000"]
  
  if (parts.length !== 4 || parts[0] !== 'blocked') {
    return null;
  }
  
  const day = parts[1]; // "MON"
  const startTime = parts[2]; // "1500"
  const endTime = parts[3]; // "2000"
  
  // Day를 숫자로 변환 (MON=0, TUE=1, ...)
  const dayMap: Record<string, number> = {
    'MON': 0, 'TUE': 1, 'WED': 2, 'THU': 3, 'FRI': 4, 'SAT': 5
  };
  const dayNumber = dayMap[day];
  
  if (dayNumber === undefined) return null;
  
  // 시간을 숫자로 변환 (09:00 기준)
  // 15:00 → 15 - 9 = 6
  // 20:00 → 20 - 9 = 11
  const startHour = parseInt(startTime.substring(0, 2), 10) - 9;
  const endHour = parseInt(endTime.substring(0, 2), 10) - 9;
  
  // 7-9시 같은 경우는 음수가 될 수 있음 (09:00 기준 -2)
  // 이 경우도 정상적으로 처리되어야 함
  if (startHour < -2 || startHour > 13 || endHour < -2 || endHour > 13) {
    return null;
  }
  
  return {
    day: dayNumber,
    start: startHour,
    end: endHour,
    label: `blocked_${day}_${startTime}_${endTime}`
  };
}

// 사용 예시
const blockedTime = parseBlockedTimeValue("blocked_MON_1500_2000");
// 결과: { day: 0, start: 6, end: 11, label: "blocked_MON_1500_2000" }
```

### 3. 시간 범위 확장 지원

이제 7-9시 같은 이른 시간도 지원됩니다:

```typescript
// 7-9시는 09:00 기준으로 -2 ~ 0
const blockedTime = parseBlockedTimeValue("blocked_MON_0700_0900");
// 결과: { day: 0, start: -2, end: 0, label: "blocked_MON_0700_0900" }

// blockedTimes 배열에 추가
blockedTimes.push({
  day: blockedTime.day,
  start: blockedTime.start,
  end: blockedTime.end,
  label: "월요일 07:00-09:00 불가"
});
```

---

## ✅ 테스트 케이스

다음 입력들이 모두 올바르게 파싱되는지 확인하세요:

### 한국어 입력
- ✅ `"월요일 7-9시 알바"` → `"blocked_MON_0700_0900"`
- ✅ `"월요일 15:00-20:00 불가"` → `"blocked_MON_1500_2000"`
- ✅ `"수요일 18-19시"` → `"blocked_WED_1800_1900"`

### 영어 입력 (새로 지원)
- ✅ `"Monday 3 PM - 8 PM is unavailable"` → `"blocked_MON_1500_2000"`
- ✅ `"MON 3 PM - 8 PM part-time job"` → `"blocked_MON_1500_2000"`
- ✅ `"Wednesday 6 PM - 7 PM"` → `"blocked_WED_1800_1900"`

---

## 🚨 주의사항

### 1. 중복 방지

같은 시간대가 여러 번 추가되지 않도록 UI에서 체크:

```typescript
// 조건 추가 전 중복 체크
const isDuplicate = conditions.some(c => c.value === newCondition.value);
if (isDuplicate) {
  // 이미 추가된 시간대입니다
  return;
}
```

### 2. 시간 범위 확장

이제 7시-22시까지 모든 시간대를 지원합니다:
- 7-9시: `start: -2, end: 0` (09:00 기준)
- 9-22시: `start: 0-13, end: 0-13` (09:00 기준)

### 3. 음수 시간 처리

`start`가 음수일 수 있으므로 UI에서 올바르게 처리:

```typescript
// 시간 표시 시
function formatTime(hour: number): string {
  const actualHour = 9 + hour; // 09:00 기준
  return `${actualHour.toString().padStart(2, '0')}:00`;
}

// 예: start: -2 → "07:00"
// 예: start: 0 → "09:00"
// 예: start: 9 → "18:00"
```

---

## 📝 요약

1. ✅ 영어 형식(AM/PM) 파싱 지원 추가
2. ✅ 이유 텍스트는 무시되고 시간만 추출
3. ✅ 동일한 시간대는 동일한 value 생성
4. ⚠️ 프론트엔드에서 중복 체크 필요
5. ⚠️ 음수 시간(start: -2 등) 처리 필요

---

## 문의

문제가 발생하거나 질문이 있으시면 백엔드 팀에 문의해주세요.
