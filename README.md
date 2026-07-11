# DART 재무비교 대시보드

국내 상장/등록 기업의 재무제표를 **회사명으로 검색**해서, 여러 회사의 **최근 3개년 재무제표를 한 화면에서 비교**하는 웹 대시보드입니다. 금융감독원 [DART 오픈API](https://opendart.fss.or.kr)에서 실시간으로 데이터를 가져오며, 결과는 화면(표+차트)으로 보거나 엑셀 파일로 내려받을 수 있습니다.

같은 저장소에는 웹 대시보드 이전에 만든 파이썬 CLI 버전도 함께 들어있습니다.

## 이 웹사이트가 하는 일

1. **회사명 검색** — 입력한 글자가 포함된 국내 등록 회사를 실시간으로 찾아줍니다 (상장사 우선 정렬).
2. **여러 회사 선택** — 검색 결과에서 2개 이상 골라 비교 목록에 추가합니다.
3. **기준 연도 입력** — 입력한 연도와 그 이전 2개년, 총 3개년 데이터를 한 번에 조회합니다.
4. **회사별 재무제표** — 회사마다 독립된 카드로 매출액/영업이익/자산·부채·자본 등 원본 수치와 재무비율을 보여줍니다.
5. **종합 비교** — 매출액 추이 꺾은선 차트, 영업이익률·ROE·부채비율 막대 차트로 한눈에 비교하고, 그 아래 전체 재무비율·성장률(YoY) 비교표를 제공합니다.
6. **엑셀 다운로드** — 화면과 동일한 내용을 `.xlsx` 파일(비교표 시트 + 회사별 시트)로 내려받습니다.

## 기술 스택

**프레임워크 / 언어**
- [Next.js 16](https://nextjs.org) (App Router, Turbopack) + React 19 + TypeScript
- 배포 대상: [Vercel](https://vercel.com)

**스타일링**
- Tailwind CSS v4 (CSS 기반 `@theme` 토큰으로 브랜드 컬러 정의)
- 커스텀 디자인 시스템: 카드형 레이아웃, 라운드 처리, 시스템 폰트 스택 기반의 깔끔한 UI

**데이터 시각화**
- [Recharts](https://recharts.org) — 매출액 추이 라인차트, 재무비율 바차트

**엑셀 생성**
- [ExcelJS](https://github.com/exceljs/exceljs) — 서버(API 라우트)에서 `.xlsx` 파일을 즉석 생성

**외부 데이터**
- [DART 오픈API](https://opendart.fss.or.kr) (금융감독원 전자공시시스템) — 회사 코드 조회, 단일회사 전체 재무제표(연결 우선, 없으면 개별)
- 회사 코드 목록(약 11만 건)은 매 요청마다 DART에서 내려받지 않고, `lib/data/corpCodes.json`에 미리 정제해 번들 — 검색 응답을 즉시(수 ms) 처리하기 위함
- 계정과목명은 회사마다 표기가 달라(예: "매출액" vs "영업수익", 공백 유무) 후보 목록 + 정규화로 흡수 (`lib/dartAccounts.ts`)

**CLI 버전 (파이썬)**
- `requests`, `openpyxl`

## 아키텍처 개요

```
app/
  page.tsx                 메인 대시보드 UI (검색, 선택, 결과 렌더링)
  components/
    CompanyStatement.tsx    회사별 재무제표 카드
    ComparisonCharts.tsx    매출/비율 차트 (recharts)
  api/
    search/route.ts         GET  회사명 검색 (번들된 회사 목록에서 조회)
    compare/route.ts         POST 여러 회사 비교 결과 JSON
    compare/excel/route.ts   POST 동일 입력 → 엑셀 파일 응답

lib/
  dartClient.ts             DART API 호출 (재무제표 조회), 회사 검색
  dartAccounts.ts           계정과목명 후보 매핑
  ratios.ts                 재무비율/성장률 계산, 공통 라벨/필드 정의
  compareService.ts         회사 검색 → 재무제표 조회 → 비율 계산 오케스트레이션
  data/corpCodes.json       번들된 회사 코드 목록 (검색용)

scripts/
  update-corp-codes.mjs     DART에서 회사 코드 목록을 다시 받아 corpCodes.json 갱신
```

## 로컬 실행

```bash
npm install
cp .env.local.example .env.local   # DART_API_KEY 입력
npm run dev
```

`http://localhost:3000`에서 회사명 검색 → 2개 이상 선택 → 기준 연도 입력 → "비교하기" 또는 "엑셀 다운로드".

[DART 오픈API](https://opendart.fss.or.kr)에서 무료 회원가입 후 인증키를 발급받아야 합니다.

### 회사 코드 목록 갱신

검색에 쓰는 회사 목록(`lib/data/corpCodes.json`)은 정적 파일이라 시간이 지나면 신규/변경된 회사가 빠질 수 있습니다. 최신화하려면:

```bash
DART_API_KEY=발급받은키 npm run update-corp-codes
```

## Vercel 배포

1. 이 저장소를 Vercel 프로젝트로 연결 (Next.js 자동 감지)
2. Vercel 프로젝트 **Settings → Environment Variables**에 `DART_API_KEY` 추가 (값: DART 오픈API 인증키)
3. **Settings → Deployment Protection**에서 "Vercel Authentication"을 꺼야 검색/비교 API가 정상 동작합니다 (켜져 있으면 API 요청이 로그인 페이지로 리다이렉트되어 막힙니다)
4. 배포 실행

`config.json`, `.env.local` 등 로컬 파일은 저장소에 포함되지 않으므로, Vercel에서는 반드시 환경변수로 키를 설정해야 합니다.

## API 라우트

| 메서드/경로 | 설명 |
|---|---|
| `GET /api/search?q=회사명` | 회사명 검색 (부분 일치, 상장사 우선) |
| `POST /api/compare` | `{ companies: string[], year: number }` → 비교 결과 JSON |
| `POST /api/compare/excel` | 위와 동일한 입력 → 엑셀 파일 다운로드 |

## 계산되는 지표

- **수익성**: 매출총이익률, 영업이익률, 순이익률, ROA, ROE
- **유동성**: 유동비율, 당좌비율, 현금비율
- **레버리지**: 부채비율, 부채자산비율, 이자보상배율
- **효율성**: 총자산회전율
- **현금흐름**: 영업현금흐름 대비 순이익 배율
- **성장성**: 매출/영업이익/순이익/자산/자본의 YoY 성장률

## 동작 방식 (DART 연동 세부사항)

- 연결재무제표(CFS)를 우선 조회하고, 없으면 개별재무제표(OFS)로 대체 조회
- 재무제표는 사업보고서(연간, `reprt_code=11011`) 기준이며, 기준 연도 1회 조회로 해당 연도 + 이전 2개년(`thstrm`/`frmtrm`/`bfefrmtrm`) 데이터를 동시에 받아옵니다
- 회사마다 계정과목명 표기가 다른 문제를 후보 목록과 공백 정규화로 흡수

---

## 파이썬 CLI 버전

웹 대시보드 이전에 만든 커맨드라인 도구입니다. 같은 계산 로직(재무비율/성장률)을 파이썬으로 구현했습니다.

### 설치

```bash
pip install requests openpyxl
```

### 1. 로컬 JSON 재무 데이터 분석 — `financial_analyzer.py`

`sample_input.json` 형식으로 회사의 연도별 재무 데이터를 준비하면, 위와 동일한 지표를 계산해 보여줍니다.

```bash
python3 financial_analyzer.py sample_input.json
python3 financial_analyzer.py sample_input.json --csv report.csv
```

입력 JSON 형식:

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

### 2. DART 연동 다중 기업 비교 — `compare_companies.py`

```bash
# 회사명 검색
python3 compare_companies.py --search "삼성전자"

# 3개 회사 3개년 비교 → 엑셀 저장
python3 compare_companies.py --companies "삼성전자" "SK하이닉스" "LG전자" --year 2024 --output comparison.xlsx
```

사전 준비: `config.example.json`을 `config.json`으로 복사한 뒤 발급받은 DART API 키 입력 (`config.json`은 `.gitignore`에 등록되어 있어 커밋되지 않습니다).

## 파일 구성

| 파일/폴더 | 설명 |
|---|---|
| `app/` | Next.js 웹 대시보드 (페이지 + 컴포넌트 + API 라우트) |
| `lib/` | 웹 대시보드용 DART 연동 + 재무비율 계산 로직 (TypeScript) |
| `scripts/update-corp-codes.mjs` | 회사 코드 목록 갱신 스크립트 |
| `financial_analyzer.py` | 로컬 JSON 입력 기반 단일 회사 재무비율 분석 (CLI) |
| `dart_api.py` | DART 오픈API 연동 (회사 검색, 재무제표 조회/파싱) (CLI) |
| `compare_companies.py` | 다중 회사 비교 CLI + 엑셀 리포트 생성 (CLI) |
| `sample_input.json` | `financial_analyzer.py` 테스트용 샘플 데이터 |
| `config.example.json` | CLI용 DART API 키 설정 템플릿 |
| `.env.local.example` | 웹 대시보드용 DART API 키 설정 템플릿 |

## 주의사항

- `config.json`, `.env.local`에는 개인 DART API 키가 들어가므로 절대 공개 저장소에 커밋하거나 공유하지 마세요.
- Vercel 배포 시에는 `DART_API_KEY`를 프로젝트 환경변수로 등록해야 합니다.
- Vercel의 "Deployment Protection(Vercel Authentication)"이 켜져 있으면 API 라우트가 로그인 페이지로 리다이렉트되어 검색/비교 기능이 동작하지 않습니다. 꺼두세요.
