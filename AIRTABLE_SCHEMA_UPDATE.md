# Airtable 스키마 업데이트 가이드

## 📢 변경사항

백엔드가 새로운 Airtable 스키마에 맞춰 업데이트되었습니다.

## 🔄 주요 변경사항

### 1. 테이블 ID 사용
- **테이블 ID**: `tbl8Mza7Z65g7Pton` (Courses Table)
- 테이블 이름 변경에도 영향받지 않도록 테이블 ID를 우선 사용합니다.
- 환경 변수 `AIRTABLE_TABLE_ID`로 설정 가능 (기본값: `tbl8Mza7Z65g7Pton`)

### 2. 필드 ID 우선 사용
필드 이름 변경에 대비하여 필드 ID를 우선 사용합니다. 필드 이름은 fallback으로 사용됩니다.

### 3. 필드 매핑

| 새 필드 (Field ID) | Field Name | 백엔드 필드 | 설명 |
|-------------------|------------|------------|------|
| `fldxBRALu8pnBwGvn` | `course_name` | `name` | 과목명 |
| `fldnrkAKox1BAjAp1` | `id` | `courseId` | 고유 ID (예: "2026_1_BUS1059_11347") |
| `fldqgpYh3n8lpCDj4` | `course_code` | - | 과목 코드 (예: "11347") |
| `fldyYL2fEvg61cTZY` | `professor` | `instructor` | 교수명 |
| `fldkXofStJWCLRFpL` | `classification` | `category` | 분류 (교양필수, 전공핵심 등) |
| `fldtXa5UzuOayoKS1` | `credit` | `credits` | 학점 |
| `fldGifKoI5xDcvCP1` | `capacity` | `capacity` | 정원 |
| `fldv3ZYOBW2kKqh10` | `lecture_type` | `deliveryType` | 수업 방식 (온라인/오프라인/혼합) |
| `fld7XicgiX9cukCAu` | `schedule_text` | `meetingTimes` | 시간표 정보 (Long text) |
| `fldYU6iYuGyEu6dWY` | `restrictions` | `restrictions` | 제한사항 |
| `fldVAPyjkCSXv6D65` | `interest_categories` | `tags` | 관심 카테고리 (Multiple select) |
| `fldkv2NYfExqtJ5hW` | `ai_tags` | `tags` | AI 태그 (Multiple select) |

### 4. 시간표 파싱 개선

`schedule_text` 필드 형식을 지원하도록 파싱 로직이 개선되었습니다:

**형식 예시:**
```
"월 16:00-17:30 (경영관 101강의실); 월 17:30-19:00 (경영관 101강의실)"
"목 09:00-10:30 (경영관 B101강의실); 목 10:30-12:00 (경영관 B101강의실)"
```

**처리 방식:**
- 세미콜론(`;`) 또는 쉼표(`,`)로 여러 시간대 구분
- 괄호 안의 장소 정보는 자동으로 제거
- 시간 정보만 추출하여 파싱

## 🔧 환경 변수 설정

### 필수 환경 변수
```env
AIRTABLE_TOKEN=your_airtable_token
AIRTABLE_BASE_ID=your_base_id
```

### 선택 환경 변수
```env
# 테이블 ID (기본값: tbl8Mza7Z65g7Pton)
AIRTABLE_TABLE_ID=tbl8Mza7Z65g7Pton

# 테이블 이름 (fallback, 기본값: Courses)
AIRTABLE_TABLE_NAME=Courses
```

## 📋 필드 매핑 상세

### `lecture_type` → `deliveryType` 변환

| lecture_type 값 | deliveryType |
|----------------|--------------|
| "온라인" | `ONLINE` |
| "온오프혼합", "온오프혼합 (Smart-F)", "온오프혼합 (Blended)" | `HYBRID` |
| 기타 (오프라인 등) | `OFFLINE` |

### `tags` 필드 구성

`tags` 배열은 다음 두 필드를 합쳐서 구성됩니다:
1. `interest_categories` (관심 카테고리)
2. `ai_tags` (AI 태그)

예시:
- `interest_categories`: ["AI/코딩", "재테크/금융"]
- `ai_tags`: ["#팀플50%", "#시험없음"]
- 결과 `tags`: ["AI/코딩", "재테크/금융", "#팀플50%", "#시험없음"]

### `major` 필드

`major` 필드는 다음 우선순위로 설정됩니다:
1. `major` 필드 (기존)
2. `Area` 필드 (fldKu4Pa3e5zDUo3f)
3. `classification` 필드 (fldkXofStJWCLRFpL)
4. 빈 문자열

## ⚠️ 주의사항

1. **필드 ID 우선 사용**: 필드 이름이 변경되어도 필드 ID를 사용하므로 API 요청이 계속 작동합니다.
2. **하위 호환성**: 기존 필드 이름도 fallback으로 지원하므로, 점진적 마이그레이션이 가능합니다.
3. **시간표 파싱**: `schedule_text` 필드의 형식이 변경되면 파싱 로직도 업데이트가 필요할 수 있습니다.

## 🔍 디버깅

시간표 파싱 실패 시 로그에 다음 정보가 출력됩니다:
- 경고 메시지: `[WARNING] Failed to parse meetingTimes for "{courseName}": "{schedule_text}"`
- 빈 meetingTimes 필드: `[WARNING] Course "{courseName}" ({recordId}) has no meetingTimes field.`

## 📝 추가 정보

- 테이블 ID와 필드 ID는 Airtable API 문서에서 확인할 수 있습니다.
- 필드 ID를 사용하면 필드 이름 변경에 영향받지 않습니다.
- 환경 변수 `AIRTABLE_TABLE_ID`를 설정하면 테이블 ID를 명시적으로 지정할 수 있습니다.
