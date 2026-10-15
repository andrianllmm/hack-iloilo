# OPA data reconciliation notes

Discrepancies and cross-checks found while cleaning (#55) and transforming (#57)
the raw IRPC/OPA source documents. Source figures are transcribed faithfully in
`data/opa/clean/`; this note records where the sources disagree and which value
the structured CSVs adopt.

## Discrepancies (source-internal conflicts)

1. **Procurement — paddy weight on the Acknowledgement Receipt.**
   `IRPC Procurement Sample Files0001` page 1 states "**2,332 kg** at 21/kg".
   Every other document in the same set — Disbursement Voucher, Accounts Payable
   Voucher, Request for Payment, WSR-1, Weigher's Tally Sheets, and RECR — states
   **8,763 kg**, and 8,763 × ₱21 = ₱184,023 (the amount paid on all documents,
   incl. the Acknowledgement Receipt itself). 2,332 × 21 = ₱48,972 ≠ ₱184,023.
   → **Adopted: 8,763 kg** in `op_procurement.csv`. The 2,332 is treated as a
   transcription/typo on the receipt.

2. **Milling — two receipts, different rice totals.**
   `IRPC Milling Sample Files0003` page 1 has two Warehouse Stock Receipts for the
   same batch 21 / 9,295.20 kg input: Receipt A reports Total (kg) Rice = **5,985**
   (232-ish bags) while Receipt B reports **1,831**. Both show Final Recovery
   64.39%. These appear to be two partial milling runs or a draft + final.
   → **Adopted: 5,985 kg** (the full-run receipt) in `op_milling.csv`; the 1,831
   receipt is noted here but not separately modelled.

3. **Drying — bag-count ambiguities (handwriting).**
   `IRPC Drying Sample Files0002`: the Warehouse Stock Receipt row shows
   No. of Bags = **232** but its Total line reads **132**; the Job Order "After
   Job Execution" shows Final No. of Bags **202**. Input bags on the Issue Receipt
   and Job Order = **235**.
   → **Adopted: input 235 bags** in `op_drying.csv`; dried-output bag count left
   out (illegible/conflicting). Weights (11,704 → 9,295.20 kg) are consistent
   across all three drying documents.

## Cross-checks that HOLD (consistency confirmed)

- **Procurement weight:** tally sheets 7,524 kg (150 bags) + 1,239 kg (25 bags)
  = **8,763 kg / 175 bags** — matches WSR-1 Bascula weight and RECR.
- **Process chain (Jackpot):** drying dried-weight **9,295.20 kg** = milling
  input **9,295.20 kg** — the drying output feeds the milling input exactly.
- **Sales:** Cash Sale #08020 ↔ WSIR #14649; 150 bags × 50 kg = **7,500 kg**;
  the WSIR carries `CS# 8020` linking the two.
- **Financial statements (2024, 2025, 2026):** for every year, each section's
  line items in the TOTAL column sum exactly to the printed section total, and
  TOTAL ASSETS = TOTAL LIABILITIES AND EQUITY. Verified programmatically in the
  transform step (all OK).

## PSA production data

The three PSA Open-Data exports are single-figure files (one Palay volume each)
wrapped in an HTML metadata footer; the annual municipality workbook is a
multi-level pivot. Values carried into `psa_rice_production.csv` and the
`municipality_*.csv` files are unchanged from source — only the HTML/metadata was
dropped and the tables were reshaped to tidy (long) form.
