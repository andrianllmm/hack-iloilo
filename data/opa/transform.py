#!/usr/bin/env python
"""Transform cleaned OPA data into structured tidy CSVs. Reads from the raw
xlsx (authoritative) for the PSA/municipality data and from the cleaned
financial-statement markdown for the financials. Writes to data/opa/transform/.
"""
import csv, os, re, glob
import openpyxl

# repo layout: data/opa/transform.py -> repo root is two levels up
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
RAW = f"{REPO}/data/opa/raw"
CLEAN = f"{REPO}/data/opa/clean"
OUT = f"{REPO}/data/opa/transform"
os.makedirs(OUT, exist_ok=True)

def writecsv(name, header, rows):
    with open(f"{OUT}/{name}", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)
    print(f"WROTE {name}: {len(rows)} rows")

# ---------- A. PSA rice production ----------
psa = []
# regional 2025
psa.append(["Region VI (Western Visayas)", "region", 2025, "Palay",
            "Volume of Production", "metric tons", 1485758.03])
# provincial 2025
psa.append(["Iloilo", "province", 2025, "Palay",
            "Volume of Production", "metric tons", 837852.21])
# provincial 2020-2024
for yr, val in [(2020, 993789.87), (2021, 1018989.02), (2022, 1016587.87),
                (2023, 1066065.52), (2024, 831333.77)]:
    psa.append(["Iloilo", "province", yr, "Palay",
                "Volume of Production", "metric tons", val])
writecsv("psa_rice_production.csv",
         ["area", "area_type", "year", "crop", "metric", "unit", "value"], psa)

# ---------- B. Municipality report (planting + harvesting) ----------
def merged_lookup(ws):
    m = {}
    for mr in ws.merged_cells.ranges:
        anchor = ws.cell(mr.min_row, mr.min_col).value
        for r in range(mr.min_row, mr.max_row + 1):
            for c in range(mr.min_col, mr.max_col + 1):
                m[(r, c)] = anchor
    def cell(r, c):
        if (r, c) in m:
            return m[(r, c)]
        return ws.cell(r, c).value
    return cell

def transform_municipality(sheet, outname):
    wb = openpyxl.load_workbook(f"{RAW}/ANNUAL REPORT PROVINCIAL DATA 2025.xlsx", data_only=True)
    ws = wb[sheet]
    cell = merged_lookup(ws)
    maxc = ws.max_column
    maxr = ws.max_row
    # classify data columns 4..maxc
    cols = {}
    for c in range(4, maxc + 1):
        eco = cell(4, c)
        sub = cell(6, c)
        seed = cell(7, c)
        method = cell(8, c)
        unit = cell(9, c)
        # skip columns with no header at all
        if not any([eco, seed, method]):
            continue
        method_s = str(method or "").strip() if method else ""
        unit_s = str(unit or "").strip() if unit else ""
        # keep only the seed-class x method area grid; drop Remarks, farmer-count,
        # Physical Area and % columns (no method sub-header / different unit)
        if method_s not in ("Direct Seeded", "Transplanted", "Total Area Planted"):
            continue
        if not unit_s.endswith("(ha)"):   # Area Planted / Area Harvested (ha)
            continue
        eco_s = str(eco or "").strip()
        sub_s = str(sub or "").strip() if sub else ""
        if sub_s == eco_s:
            sub_s = ""  # row-6 just repeats the ecosystem (irrigated); not a real sub-level
        cols[c] = (eco_s, sub_s,
                   str(seed or "").strip() if seed else "",
                   method_s, unit_s)
    rows = []
    cur_month = None
    skipped = 0
    for r in range(11, maxr + 1):
        a = ws.cell(r, 1).value  # Month
        if a not in (None, ""):
            cur_month = str(a).strip()
        muni = ws.cell(r, 2).value
        if muni in (None, ""):
            continue
        period = ws.cell(r, 3).value
        for c, (eco, sub, seed, method, unit) in cols.items():
            v = ws.cell(r, c).value
            if v in (None, "") or str(v).strip() in ("-", "—"):
                continue  # drop blanks and dash placeholders (no-data) in the transform
            try:
                num = float(str(v).replace(",", "").strip())
            except ValueError:
                skipped += 1   # stray non-numeric cell in the area grid
                continue
            rows.append([cur_month, str(muni).strip(),
                         str(period).strip() if period else "",
                         eco, sub, seed, method, unit, num])
    if skipped:
        print(f"    ({outname}: skipped {skipped} non-numeric grid cells)")
    writecsv(outname,
             ["month", "municipality", "period", "ecosystem", "sub_ecosystem",
              "seed_class", "seeding_method", "unit", "value"], rows)

def clean(s):
    return re.sub(r"\s+", " ", str(s)).strip() if s else ""

def transform_harvesting(sheet, outname):
    # harvesting schema: row4 ecosystem, row6 sub, row8 seed_class, row9 metric
    wb = openpyxl.load_workbook(f"{RAW}/ANNUAL REPORT PROVINCIAL DATA 2025.xlsx", data_only=True)
    ws = wb[sheet]
    cell = merged_lookup(ws)
    SEEDS = {"HYBRID SEEDS", "CERTIFIED SEEDS", "GOOD SEEDS",
             "FARMERS HOME SAVED SEEDS", "TOTAL"}
    cols = {}
    for c in range(4, ws.max_column + 1):
        seed = clean(cell(8, c))
        metric = clean(cell(9, c))
        if seed not in SEEDS or not metric:
            continue
        eco = clean(cell(4, c))
        sub = clean(cell(6, c))
        if sub == eco:
            sub = ""
        cols[c] = (eco, sub, seed, metric)
    rows = []
    cur_month = None
    skipped = 0
    for r in range(11, ws.max_row + 1):
        a = ws.cell(r, 1).value
        if a not in (None, ""):
            cur_month = str(a).strip()
        muni = ws.cell(r, 2).value
        if muni in (None, ""):
            continue
        period = ws.cell(r, 3).value
        for c, (eco, sub, seed, metric) in cols.items():
            v = ws.cell(r, c).value
            if v in (None, "") or str(v).strip() in ("-", "—"):
                continue
            try:
                num = float(str(v).replace(",", "").strip())
            except ValueError:
                skipped += 1
                continue
            rows.append([cur_month, str(muni).strip(),
                         str(period).strip() if period else "",
                         eco, sub, seed, metric, num])
    if skipped:
        print(f"    ({outname}: skipped {skipped} non-numeric grid cells)")
    writecsv(outname,
             ["month", "municipality", "period", "ecosystem", "sub_ecosystem",
              "seed_class", "metric", "value"], rows)

transform_municipality("BY MUNICIPALITY (Planting)", "municipality_planting.csv")
transform_harvesting("BY MUNICIPALITY (harvesting)", "municipality_harvesting.csv")

# ---------- C. Financial statements (parse cleaned markdown) ----------
def parse_amount(s):
    s = s.strip().replace("**", "").replace("₱", "").replace(",", "").strip()
    if s in ("", "—", "-"):
        return None
    neg = s.startswith("(") and s.endswith(")")
    s = s.strip("()")
    try:
        v = float(s)
    except ValueError:
        return None
    return -v if neg else v

def split_row(line):
    # "| a | b | c |" -> [a,b,c]
    parts = [p.strip() for p in line.strip().strip("|").split("|")]
    return parts

perf_rows = []   # year, period, section, line_item, amount
pos_rows = []    # year, as_of, section, line_item, amount
for md in sorted(glob.glob(f"{CLEAN}/IRPC Financial Statement */*.md")):
    if os.path.basename(md) == "skill-output.md":
        continue  # Docling comparison artifact, not an authoritative transcription
    base = os.path.basename(os.path.dirname(md))
    year = int(re.search(r"(\d{4})", base).group(1))
    text = open(md, encoding="utf-8").read()
    lines = text.splitlines()
    mode = None          # 'perf' or 'pos'
    periods = []         # column period labels for perf
    section = ""
    as_of = ""
    pos_section = ""
    for ln in lines:
        low = ln.lower()
        if ln.startswith("## Page 1") or "monthly statement of financial performance" in low:
            mode = "perf"; continue
        if "statement of financial position" in low and ln.startswith("##"):
            mode = "pos"
            m = re.search(r"as of ([^)]+)\)", ln, re.I)
            as_of = m.group(1).strip() if m else ""
            continue
        if ln.startswith("## Page 3") or "breakdown" in low and ln.startswith("##"):
            mode = None; continue
        if not ln.strip().startswith("|"):
            # section sub-headers in perf given as "### Income" etc
            if mode == "perf" and ln.startswith("### "):
                section = ln[4:].strip()
            continue
        cells = split_row(ln)
        if set("".join(cells)) <= set("-: "):  # separator row
            continue
        if mode == "perf":
            first = cells[0]
            # header row with month columns
            if first.lower() in ("line", "line item", "") and any("202" in c or c.upper() == "TOTAL" for c in cells[1:]):
                periods = cells[1:]
                continue
            # bold-only section row e.g. **INCOME** with rest empty
            label = first.replace("**", "").strip()
            rest = cells[1:]
            if label and all(c.strip() == "" for c in rest):
                section = label
                continue
            if not label:
                continue
            # summary/bottom-line rows don't belong to the preceding cost section
            if re.search(r"net operating income|other income|net surplus", label, re.I):
                row_section = "Net / Summary"
            else:
                row_section = section
            for i, c in enumerate(rest):
                if i >= len(periods):
                    break
                amt = parse_amount(c)
                if amt is None:
                    continue
                perf_rows.append([year, periods[i], row_section, label, amt])
        elif mode == "pos":
            first = cells[0].replace("**", "").strip()
            # header rows define section
            if first in ("ASSETS", "LIABILITIES AND EQUITY") and (len(cells) < 2 or cells[1].strip() == ""):
                pos_section = first
                continue
            if len(cells) < 2:
                continue
            amt = parse_amount(cells[1])
            if first == "" or amt is None:
                continue
            pos_rows.append([year, as_of, pos_section, first, amt])

writecsv("financial_performance.csv",
         ["year", "period", "section", "line_item", "amount_php"], perf_rows)
writecsv("financial_position.csv",
         ["year", "as_of", "section", "line_item", "amount_php"], pos_rows)

# ---------- D. Operational logs ----------
writecsv("op_procurement.csv",
         ["batch_no", "date", "supplier", "address", "variety", "bags", "net_kg",
          "mc_pct", "price_php_per_kg", "total_php", "wsr_no", "apv_no",
          "rfp_no", "recr_serial"],
         [[27, "2026-10-01", "Joelie Decipulo Tacuyan", "Brgy. Igang, Pototan, Iloilo",
           "270H", 175, 8763, 22, 21, 184023.00, 2911, "00000060", 1626, "027-2026"]])

writecsv("op_drying.csv",
         ["batch_no", "farmer", "address", "variety", "initial_mc_pct",
          "final_mc_pct", "input_kg", "dried_kg", "input_bags", "remarks",
          "wsr2_no", "wsir2_no", "job_order_serial"],
         [[23, "Star May Desacuia", "Bongac, Mina, Iloilo", "Jackpot", 23, 13.5,
           11704, 9295.20, 235, "1st cropping / direct milling", 1295, 2812, "023-2026"]])

writecsv("op_milling.csv",
         ["batch_no", "variety", "input_kg", "mc_pct", "rice_kg", "bran_kg",
          "brewer_kg", "sorter_kg", "recovery_pct", "milling_time_hrs",
          "wsr3_no", "wsir2_no", "job_order_serial"],
         [[21, "Jackpot", 9295.20, 14, 5985, 750, 13, 1, 64.39, 3,
           "021-26", 764, "21-2026"]])

writecsv("op_sales.csv",
         ["cash_sale_no", "wsir_no", "date", "buyer", "address", "product",
          "bags", "kg", "unit_price_php_per_bag", "amount_php"],
         [["08020", 14649, "2024-10-14", "Rex Cordero", "Pototan", "WMR @ 50 kg",
           150, 7500, 2350, 352500.00]])

print("\n--- VALIDATION ---")
from collections import defaultdict
# 1. cross-foot each section's line items (TOTAL col) vs its printed "Total ..." line
tot = defaultdict(float)
printed = {}
for year, period, section, item, amt in perf_rows:
    if period.upper() != "TOTAL":
        continue
    il = item.lower()
    if il.startswith("total "):
        printed[(year, section)] = amt
    elif il.startswith(("total", "gross profit", "net ")):
        pass  # grand-total / summary lines, not section sums
    elif section == "Net / Summary":
        pass
    else:
        tot[(year, section)] += amt
for (year, section), s in sorted(tot.items()):
    exp = printed.get((year, section))
    flag = "OK" if (exp is not None and abs(s - exp) < 0.01) else ("no printed total" if exp is None else "MISMATCH")
    extra = "" if exp is None else f" vs printed {exp:,.2f}"
    print(f"  {year} [{section}] sum={s:,.2f}{extra} -> {flag}")
# 2. row counts per year
cnt = defaultdict(int)
for r in perf_rows:
    cnt[r[0]] += 1
print("  perf rows/year:", dict(sorted(cnt.items())))
# position balance check
posbal = defaultdict(lambda: defaultdict(float))
for year, as_of, section, item, amt in pos_rows:
    il = item.lower()
    if il == "total assets":
        posbal[year]["assets"] = amt
    if il == "total liabilities and equity":
        posbal[year]["le"] = amt
for year, d in sorted(posbal.items()):
    ok = abs(d["assets"] - d["le"]) < 0.01
    print(f"  {year} position: TOTAL ASSETS {d['assets']:,.2f} vs TOTAL L+E {d['le']:,.2f} -> {'OK' if ok else 'MISMATCH'}")
