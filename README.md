# 재무분석기 (Financial Analyzer)

기업 재무제표를 분석하는 파이썬 CLI 도구 모음입니다. 두 가지 방식으로 사용할 수 있습니다.

1. **로컬 JSON 입력 분석** — 직접 준비한 재무 데이터를 분석
2. **DART 연동 다중 기업 비교** — 회사명으로 검색해 실제 국내 상장/등록 기업의 최근 3개년 재무제표를 비교하고 엑셀로 저장

## 설치

```bash
pip install requests openpyxl
```

## 1. 로컬 JSON 재무 데이터 분석 — `financial_analyzer.py`

`sample_input.json` 형식으로 회사의 연도별 재무 데이터를 준비하면, 수익성·유동성·레버리지·효율성·성장성 지표를 계산해 보여줍니다.

```bash
python3 financial_analyzer.py sample_input.json
python3 financial_analyzer.py sample_input.json --csv report.csv
```

### 입력 JSON 형식

```json
{
  "company": "회사명",
  "periods": [
    {
      "period": "2024",
      "revenue": 1300000,
      "cogs": 800000,
      "operating_income": 180000,
      "net_income": 140000,
      "interest_expense": 17000,
      "total_assets": 1800000,
      "current_assets": 750000,
      "inventory": 190000,
      "cash": 260000,
      "total_liabilities": 750000,
      "current_liabilities": 340000,
      "total_equity": 1050000,
      "operating_cash_flow": 160000
    }
  ]
}
```

periods를 여러 개 넣으면 연도 간 YoY 성장률도 함께 계산됩니다.

### 계산되는 지표

- **수익성**: 매출총이익률, 영업이익률, 순이익률, ROA, ROE
- **유동성**: 유동비율, 당좌비율, 현금비율
- **레버리지**: 부채비율, 부채자산비율, 이자보상배율
- **효율성**: 총자산회전율
- **현금흐름**: 영업현금흐름 대비 순이익 배율
- **성장성**: 매출/영업이익/순이익/자산/자본의 YoY 성장률

## 2. DART 연동 다중 기업 비교 — `compare_companies.py`

금융감독원 [DART 오픈API](https://opendart.fss.or.kr)를 이용해 실제 회사명으로 검색하고, 여러 회사의 최근 3개년 재무제표를 한 번에 비교해 엑셀 파일로 저장합니다.

### 사전 준비

1. [DART 오픈API](https://opendart.fss.or.kr)에서 무료 회원가입 후 인증키(API key) 발급
2. `config.example.json`을 `config.json`으로 복사한 뒤 발급받은 키 입력

```bash
cp config.example.json config.json
```

```json
{
  "dart_api_key": "발급받은 키"
}
```

`config.json`은 `.gitignore`에 등록되어 있어 저장소에 커밋되지 않습니다.

### 회사명 검색

```bash
python3 compare_companies.py --search "삼성전자"
```

### 3개 회사 3개년 비교 → 엑셀 저장

```bash
python3 compare_companies.py --companies "삼성전자" "SK하이닉스" "LG전자" --year 2024 --output comparison.xlsx
```

`--year`에 지정한 연도를 기준으로 이전 2개년까지 총 3개년 데이터를 자동으로 조회합니다.

생성된 엑셀에는 다음 시트가 포함됩니다.

- **비교표**: 지표별로 회사 × 연도를 나란히 비교
- **회사별 시트**: 원본 재무 수치, 재무비율, 성장률 상세

### 동작 방식

- 연결재무제표(CFS)를 우선 조회하고, 없으면 개별재무제표(OFS)로 대체 조회
- 회사마다 계정과목명 표기가 다른 문제(예: "매출액" vs "영업수익", 공백 유무)를 후보 목록과 정규화로 흡수
- DART 기업 코드 목록(`.corp_code_cache.xml`)은 로컬에 캐싱되어 7일마다 갱신

## 파일 구성

| 파일 | 설명 |
|---|---|
| `financial_analyzer.py` | 로컬 JSON 입력 기반 단일 회사 재무비율 분석 |
| `dart_api.py` | DART 오픈API 연동 (회사 검색, 재무제표 조회/파싱) |
| `compare_companies.py` | 다중 회사 비교 CLI + 엑셀 리포트 생성 |
| `sample_input.json` | `financial_analyzer.py` 테스트용 샘플 데이터 |
| `config.example.json` | DART API 키 설정 템플릿 |

## 주의사항

- `config.json`에는 개인 DART API 키가 들어가므로 절대 공개 저장소에 커밋하거나 공유하지 마세요.
