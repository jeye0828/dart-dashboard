"""DART(전자공시) 오픈API 연동 모듈

- 회사명으로 corp_code 검색
- 단일회사 전체 재무제표(연결 우선, 없으면 개별) 조회
- financial_analyzer.analyze_period()가 기대하는 스키마로 파싱
"""

import json
import os
import time
import xml.etree.ElementTree as ET
import zipfile
from io import BytesIO

import requests

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, "config.json")
CORP_CACHE_PATH = os.path.join(BASE_DIR, ".corp_code_cache.xml")
CORP_CACHE_MAX_AGE = 7 * 24 * 3600  # 7일

API_BASE = "https://opendart.fss.or.kr/api"

# DART는 업종/보고서마다 계정과목명이 조금씩 다르게 표기되므로 후보를 여러 개 둔다.
ACCOUNT_MAP = {
    "revenue": (("IS", "CIS"), ["매출액", "수익(매출액)", "영업수익", "매출"]),
    "cogs": (("IS", "CIS"), ["매출원가"]),
    "operating_income": (("IS", "CIS"), ["영업이익", "영업이익(손실)"]),
    "net_income": (("IS", "CIS"), ["당기순이익(손실)", "당기순이익", "반기순이익(손실)", "분기순이익(손실)"]),
    "interest_expense": (("IS", "CIS"), ["이자비용", "금융비용"]),
    "total_assets": (("BS",), ["자산총계"]),
    "current_assets": (("BS",), ["유동자산"]),
    "inventory": (("BS",), ["재고자산"]),
    "cash": (("BS",), ["현금및현금성자산"]),
    "total_liabilities": (("BS",), ["부채총계"]),
    "current_liabilities": (("BS",), ["유동부채"]),
    "total_equity": (("BS",), ["자본총계"]),
    "operating_cash_flow": (("CF",), ["영업활동현금흐름", "영업활동으로인한현금흐름"]),
}


class DartApiError(Exception):
    pass


def load_api_key():
    if not os.path.exists(CONFIG_PATH):
        raise DartApiError(
            f"설정 파일이 없습니다: {CONFIG_PATH}\n"
            '{"dart_api_key": "발급받은키"} 형식으로 생성해주세요.'
        )
    with open(CONFIG_PATH, encoding="utf-8") as f:
        config = json.load(f)
    key = config.get("dart_api_key")
    if not key:
        raise DartApiError("config.json에 dart_api_key가 없습니다.")
    return key


def _download_corp_code_xml(api_key):
    resp = requests.get(f"{API_BASE}/corpCode.xml", params={"crtfc_key": api_key}, timeout=30)
    resp.raise_for_status()
    content_type = resp.headers.get("Content-Type", "")
    if "zip" not in content_type and "msdownload" not in content_type and "octet-stream" not in content_type:
        # 에러 응답은 XML(JSON 아님)로 status/message 를 담아 온다
        try:
            root = ET.fromstring(resp.content)
            status = root.findtext("status")
            message = root.findtext("message")
            raise DartApiError(f"DART API 오류 ({status}): {message}")
        except ET.ParseError:
            raise DartApiError("corpCode.xml 응답을 해석할 수 없습니다.")

    zf = zipfile.ZipFile(BytesIO(resp.content))
    xml_bytes = zf.read("CORPCODE.xml")
    with open(CORP_CACHE_PATH, "wb") as f:
        f.write(xml_bytes)
    return xml_bytes


def get_corp_code_list(api_key, force_refresh=False):
    need_download = force_refresh or not os.path.exists(CORP_CACHE_PATH)
    if not need_download:
        age = time.time() - os.path.getmtime(CORP_CACHE_PATH)
        need_download = age > CORP_CACHE_MAX_AGE

    if need_download:
        xml_bytes = _download_corp_code_xml(api_key)
    else:
        with open(CORP_CACHE_PATH, "rb") as f:
            xml_bytes = f.read()

    root = ET.fromstring(xml_bytes)
    corp_list = []
    for item in root.findall("list"):
        corp_list.append(
            {
                "corp_code": item.findtext("corp_code", "").strip(),
                "corp_name": item.findtext("corp_name", "").strip(),
                "stock_code": item.findtext("stock_code", "").strip(),
            }
        )
    return corp_list


def search_company(name, corp_list):
    """회사명으로 검색. 정확히 일치하는 상장사 > 정확히 일치 > 이름 포함 상장사 순으로 정렬해 반환"""
    name = name.strip()
    exact_listed, exact, contains_listed, contains = [], [], [], []
    for c in corp_list:
        is_listed = bool(c["stock_code"])
        if c["corp_name"] == name:
            (exact_listed if is_listed else exact).append(c)
        elif name in c["corp_name"]:
            (contains_listed if is_listed else contains).append(c)
    return exact_listed + exact + contains_listed + contains


def _to_number(value):
    if value is None:
        return None
    value = value.strip().replace(",", "")
    if value in ("", "-"):
        return None
    try:
        return float(value)
    except ValueError:
        return None


def fetch_financial_rows(api_key, corp_code, base_year, reprt_code="11011"):
    """연결(CFS) 우선 조회, 데이터 없으면 개별(OFS)로 재시도"""
    for fs_div in ("CFS", "OFS"):
        params = {
            "crtfc_key": api_key,
            "corp_code": corp_code,
            "bsns_year": str(base_year),
            "reprt_code": reprt_code,
            "fs_div": fs_div,
        }
        resp = requests.get(f"{API_BASE}/fnlttSinglAcntAll.json", params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        status = data.get("status")
        if status == "000":
            return data.get("list", []), fs_div
        if status == "013":  # 조회된 데이터 없음 -> 다음 fs_div 시도
            continue
        raise DartApiError(f"DART API 오류 ({status}): {data.get('message')}")
    return [], None


def _normalize(name):
    return (name or "").replace(" ", "")


def _find_account(rows, sj_divs, candidates):
    normalized_candidates = [_normalize(c) for c in candidates]
    for target in normalized_candidates:
        for row in rows:
            if (
                row.get("sj_div") in sj_divs
                and _normalize(row.get("account_nm")) == target
                and row.get("account_detail", "-") == "-"
            ):
                return row
    return None


def parse_financials(rows, base_year):
    """DART 계정 목록 -> financial_analyzer.analyze_period()가 쓰는 3개년 periods 리스트"""
    period_keys = [("bfefrmtrm_amount", base_year - 2), ("frmtrm_amount", base_year - 1), ("thstrm_amount", base_year)]

    periods = {year: {"period": str(year)} for _, year in period_keys}

    for field, (sj_divs, candidates) in ACCOUNT_MAP.items():
        row = _find_account(rows, sj_divs, candidates)
        for amount_key, year in period_keys:
            periods[year][field] = _to_number(row.get(amount_key)) if row else None

    return [periods[year] for _, year in period_keys]


def get_company_periods(api_key, corp_code, base_year, reprt_code="11011"):
    rows, fs_div = fetch_financial_rows(api_key, corp_code, base_year, reprt_code)
    if not rows:
        raise DartApiError("재무제표 데이터를 찾을 수 없습니다 (연결/개별 모두 없음).")
    return parse_financials(rows, base_year), fs_div
