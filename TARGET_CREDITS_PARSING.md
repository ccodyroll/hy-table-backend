# 목표 학점 자연어 파싱 기능 추가

## 📢 변경사항

백엔드에서 자연어로 목표 학점을 파싱할 수 있도록 기능이 추가되었습니다.

## 🎯 지원하는 형식

다음과 같은 자연어 형식으로 목표 학점을 입력할 수 있습니다:

### 예시
- `"내 목표 학점은 12-18점이야"`
- `"15학점 목표"`
- `"12점에서 18점 사이"`
- `"최소 12점 최대 18점"`
- `"12~18학점"`

## 🔄 API 동작

### 1. `/api/parse-condition` 엔드포인트

자연어 입력에서 목표 학점을 파싱하면 다음과 같은 형식으로 반환됩니다:

**Request:**
```json
{
  "input": "내 목표 학점은 12-18점이야",
  "currentConditions": []
}
```

**Response:**
```json
{
  "conditions": [
    {
      "type": "목표학점 설정",
      "label": "12-18학점",
      "value": "12~18"
    }
  ]
}
```

### 2. `/api/recommend` 엔드포인트

`freeTextRequest` 필드에 목표 학점이 포함된 자연어를 입력하면 자동으로 파싱되어 적용됩니다.

**Request:**
```json
{
  "user": { ... },
  "targetCredits": 18,  // 기본값 (자연어로 파싱되면 덮어씀)
  "freeTextRequest": "내 목표 학점은 12-18점이야",
  ...
}
```

**동작:**
- `freeTextRequest`에서 목표 학점이 파싱되면, `targetCredits` 값보다 우선적으로 적용됩니다.
- 범위 형식 (`12~18`)이 파싱되면 `targetCreditsMin: 12`, `targetCreditsMax: 18`로 설정됩니다.
- 단일 값 (`15`)이 파싱되면 `targetCreditsMin: 15`, `targetCreditsMax: 15`로 설정됩니다.

## 📋 프론트엔드에서 해야 할 일

### 1. 조건 파싱 결과 처리

`/api/parse-condition`에서 반환된 `conditions` 배열에서 `type: "목표학점 설정"`인 항목을 찾아 처리합니다:

```typescript
const targetCreditsCondition = conditions.find(
  cond => cond.type === '목표학점 설정'
);

if (targetCreditsCondition) {
  // value 형식: "15" or "12~18"
  const value = targetCreditsCondition.value;
  
  // 범위 형식 파싱
  if (value.includes('~')) {
    const [min, max] = value.split('~').map(Number);
    // targetCreditsMin, targetCreditsMax 설정
  } else {
    const credits = Number(value);
    // targetCredits 설정
  }
}
```

### 2. UI에 목표 학점 표시

파싱된 목표 학점을 UI에 표시할 때:

```typescript
// label 사용: "12-18학점" 또는 "15학점"
const displayText = targetCreditsCondition.label;
```

### 3. `/api/recommend` 요청 시

**옵션 1: 자연어로만 전달**
```json
{
  "targetCredits": 18,  // 기본값 (선택사항)
  "freeTextRequest": "내 목표 학점은 12-18점이야"
}
```

**옵션 2: UI에서 설정한 값과 자연어 병행**
```json
{
  "targetCredits": "15~18",  // UI에서 설정한 값
  "freeTextRequest": "내 목표 학점은 12-18점이야"  // 자연어 (우선순위 높음)
}
```

**주의:** 자연어로 파싱된 목표 학점이 있으면 UI에서 설정한 `targetCredits`보다 우선 적용됩니다.

### 4. 중복 체크

사용자가 여러 번 목표 학점을 입력할 수 있으므로, 중복을 체크하고 하나만 유지하도록 처리하세요:

```typescript
// 기존 조건에서 목표 학점 제거
const existingConditions = conditions.filter(
  cond => cond.type !== '목표학점 설정'
);

// 새로운 목표 학점 추가
if (targetCreditsCondition) {
  existingConditions.push(targetCreditsCondition);
}
```

## 🔍 테스트 예시

### 테스트 1: 범위 형식
```
입력: "내 목표 학점은 12-18점이야"
예상 결과: { type: "목표학점 설정", label: "12-18학점", value: "12~18" }
```

### 테스트 2: 단일 값
```
입력: "15학점 목표"
예상 결과: { type: "목표학점 설정", label: "15학점", value: "15" }
```

### 테스트 3: 다른 조건과 함께
```
입력: "내 목표 학점은 12-18점이야. 월요일 수업은 피하고 싶어요."
예상 결과: 
[
  { type: "목표학점 설정", label: "12-18학점", value: "12~18" },
  { type: "시간 제약", label: "월요일 수업 없음", value: "MON" }
]
```

## ⚠️ 주의사항

1. **우선순위**: 자연어로 파싱된 목표 학점이 UI에서 설정한 `targetCredits`보다 우선 적용됩니다.
2. **형식**: `value` 필드는 항상 `"15"` 또는 `"12~18"` 형식입니다 (`~` 구분자 사용).
3. **표시**: `label` 필드는 사용자에게 표시하기 적합한 형식입니다 (`"12-18학점"` 또는 `"15학점"`).

## 📝 추가 정보

- 목표 학점 파싱은 Google Gemini AI를 사용합니다.
- 파싱 실패 시 기본값(`targetCredits` 필드 값)이 사용됩니다.
- 범위 형식이 파싱되면 백엔드에서 `targetCreditsMin`과 `targetCreditsMax`로 처리됩니다.
