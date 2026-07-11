#!/usr/bin/env python3
"""기업 재무제표 분석기 (Financial Statement Analyzer)

사용법:
    python financial_analyzer.py sample_input.json
    python financial_analyzer.py sample_input.json --csv report.csv
"""

import argparse
import csv
import json
import sys


def safe_div(numerator, denominator):
    if numerator is None or not denominator:
        return None
    return numerator / denominator


def analyze_period(p):
    revenue = p.get("revenue")
    cogs = p.get("cogs")
    operating_income = p.get("operating_income")
    net_income = p.get("net_income")
    interest_expense = p.get("interest_expense")
    total_assets = p.get("total_assets")
    current_assets = p.get("current_assets")
    inventory = p.get("inventory")
    cash = p.get("cash")
    total_liabilities = p.get("total_liabilities")
    current_liabilities = p.get("current_liabilities")
    total_equity = p.get("total_equity")
    operating_cash_flow = p.get("operating_cash_flow")

    gross_profit = revenue - cogs if revenue is not None and cogs is not None else None

    ratios = {
        "period": p.get("period"),
        # 수익성 (Profitability)
        "매출총이익률(%)": safe_div(gross_profit, revenue),
        "영업이익률(%)": safe_div(operating_income, revenue),
        "순이익률(%)": safe_div(net_income, revenue),
        "ROA(%)": safe_div(net_income, total_assets),
        "ROE(%)": safe_div(net_income, total_equity),
        # 유동성 (Liquidity)
        "유동비율(%)": safe_div(current_assets, current_liabilities),
        "당좌비율(%)": safe_div(
            (current_assets - inventory)
            if current_assets is not None and inventory is not None
            else None,
            current_liabilities,
        ),
        "현금비율(%)": safe_div(cash, current_liabilities),
        # 레버리지 (Leverage)
        "부채비율(%)": safe_div(total_liabilities, total_equity),
        "부채자산비율(%)": safe_div(total_liabilities, total_assets),
        "이자보상배율(x)": safe_div(operating_income, interest_expense),
        # 효율성 (Efficiency)
        "총자산회전율(x)": safe_div(revenue, total_assets),
        # 현금흐름 (Cash Flow)
        "영업현금흐름대비순이익(x)": safe_div(operating_cash_flow, net_income),
    }

    # 퍼센트로 표시할 항목은 100 곱하기
    pct_keys = [
        "매출총이익률(%)", "영업이익률(%)", "순이익률(%)", "ROA(%)", "ROE(%)",
        "유동비율(%)", "당좌비율(%)", "현금비율(%)", "부채비율(%)", "부채자산비율(%)",
    ]
    for k in pct_keys:
        if ratios[k] is not None:
            ratios[k] = ratios[k] * 100

    return ratios


def analyze_growth(periods):
    """연속된 기간 간 YoY 성장률 계산"""
    growth_rows = []
    for prev, curr in zip(periods, periods[1:]):
        row = {"period": f"{prev.get('period')} -> {curr.get('period')}"}
        for key in ["revenue", "operating_income", "net_income", "total_assets", "total_equity"]:
            prev_v, curr_v = prev.get(key), curr.get(key)
            if prev_v is not None and curr_v is not None and prev_v != 0:
                row[f"{key}_성장률(%)"] = (curr_v - prev_v) / abs(prev_v) * 100
            else:
                row[f"{key}_성장률(%)"] = None
        growth_rows.append(row)
    return growth_rows


def fmt(v):
    if v is None:
        return "N/A"
    return f"{v:,.2f}"


def print_report(company, ratio_rows, growth_rows):
    print("=" * 70)
    print(f" 재무분석 보고서: {company}")
    print("=" * 70)

    for row in ratio_rows:
        print(f"\n[ {row['period']} 기 ]")
        for k, v in row.items():
            if k == "period":
                continue
            print(f"  {k:<20}: {fmt(v)}")

    if growth_rows:
        print("\n" + "-" * 70)
        print(" 성장성 분석 (YoY)")
        print("-" * 70)
        for row in growth_rows:
            print(f"\n[ {row['period']} ]")
            for k, v in row.items():
                if k == "period":
                    continue
                print(f"  {k:<25}: {fmt(v)}")

    print("\n" + "=" * 70)


def save_csv(path, ratio_rows, growth_rows):
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        if ratio_rows:
            writer.writerow(list(ratio_rows[0].keys()))
            for row in ratio_rows:
                writer.writerow([fmt(v) if k != "period" else v for k, v in row.items()])
        if growth_rows:
            writer.writerow([])
            writer.writerow(list(growth_rows[0].keys()))
            for row in growth_rows:
                writer.writerow([fmt(v) if k != "period" else v for k, v in row.items()])


def main():
    parser = argparse.ArgumentParser(description="기업 재무제표 분석기")
    parser.add_argument("input", help="재무 데이터 JSON 파일 경로")
    parser.add_argument("--csv", help="결과를 저장할 CSV 파일 경로", default=None)
    args = parser.parse_args()

    try:
        with open(args.input, encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"오류: 파일을 찾을 수 없습니다 - {args.input}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"오류: JSON 형식이 올바르지 않습니다 - {e}", file=sys.stderr)
        sys.exit(1)

    company = data.get("company", "Unknown")
    periods = sorted(data.get("periods", []), key=lambda p: p.get("period", ""))

    if not periods:
        print("오류: 'periods' 데이터가 비어 있습니다.", file=sys.stderr)
        sys.exit(1)

    ratio_rows = [analyze_period(p) for p in periods]
    growth_rows = analyze_growth(periods)

    print_report(company, ratio_rows, growth_rows)

    if args.csv:
        save_csv(args.csv, ratio_rows, growth_rows)
        print(f"\nCSV 저장 완료: {args.csv}")


if __name__ == "__main__":
    main()
