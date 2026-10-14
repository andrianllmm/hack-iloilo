# PRD: Post-Harvest Facility Capacity Planning Platform

## Summary

IRPC can't see palay coming until it's at the gate. At harvest peak the dryers overflow and farmers go to private mills. Off-season the machines sit idle while the power bill keeps running.

We're building a web app that shows IRPC what's coming weeks ahead and suggests what to do about it. Farmers book slots, report plantings and get palay price quotes by SMS. Staff run the gate queue, record each batch as it moves through the plant, and record who bought the rice. A capacity page shows load against capacity, and the app suggests actions like moving bookings off a peak day or milling in fewer, fuller runs.

IRPC is the first facility. Nothing about IRPC, rice or Iloilo is hardcoded, so another facility, crop or region only needs its own data.

## How it works

1. **Clients tell the plant what's coming.** By SMS, farmers report plantings, book drying or milling slots, offer palay for sale, and get a price quote. Traders can book custom milling too. A co-op leader, family member or staff member can do it for them.
2. **The plant sees the next few weeks.** Bookings, reported plantings and a harvest forecast feed a capacity page for the dryers, storage and mill, with a chart, a day-by-day grid and more. Busy days and idle days show up early.
3. **The app suggests actions.** It can move flexible bookings off a busy day, send dried palay to storage and mill it later, group milling into full-load days to save power, or text farmers before an idle stretch.
4. **Staff run the day.** At the gate, booked clients and walk-ins join one queue, and the next in line get a text. Staff fill in the same fields as the paper forms, or snap a photo of the form and check what the app filled in. Palay that IRPC buys is priced on the spot. Each batch shows its cost and margin, including electricity, and which buyers its rice went to.

## Glossary

| Term                     | Meaning                                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **Facility**             | A plant that dries, stores and processes a crop. IRPC is the first one.                                           |
| **Crop**                 | What a facility handles. For IRPC it's rice, delivered as palay (unhusked rice).                                  |
| **Palay**                | Unhusked rice. Wet palay is dried first. Dried palay can be stored, then milled.                                  |
| **MC**                   | Moisture content, in percent. Wet palay arrives at about 23%. Drying brings it down to about 14%.                 |
| **Client**               | Anyone IRPC deals with: a farmer, co-op, trader, store or institution. A client may own palay, buy rice, or both. |
| **Booking**              | A reserved drying or milling slot on a future day.                                                                |
| **Queue**                | The order at the gate on the day. Booked clients and walk-ins share it.                                           |
| **Sell offer**           | A client's offer to sell palay to IRPC.                                                                           |
| **Booker**               | Whoever makes a booking or offer: the client, a co-op leader, a relative, or staff taking a phone call.           |
| **Planting declaration** | A farmer's report of what they planted: where, how many hectares, which variety, and when.                        |
| **Harvest window**       | The date range when a declared planting should be ready to harvest.                                               |
| **Capacity pool**        | One of the three things that can run out: dryer (tonnes per day), storage (tonnes held), mill (tonnes per day).   |
| **Capacity page**        | The manager's main page: expected load against each capacity pool, in several views.                              |
| **Prescription**         | An action the app suggests from the capacity page's numbers. A manager accepts, edits or dismisses it.            |
| **Batch**                | One lot of palay, tracked from the gate to the buyers of its rice. It has a batch number.                         |
| **First-hand buyer**     | Anyone who buys from, or takes first delivery from, the IRPC mill.                                                |
| **Encoder**              | The staff member who runs the queue and enters receiving, drying, milling and sales data.                         |

## The problem

IRPC staff can't plan around palay they can't see coming.

- **Peak harvest (Sep to Oct, Jan to Feb).** Palay arrives faster than the dryers can handle. Farmers wait, or take their palay to private mills. Staff find out about the overload when trucks are already at the gate.
- **Off-season (Apr to Jul).** Dryers and mill sit nearly idle. The mill runs partial loads on partial days, and base power keeps drawing.
- **No cost per batch.** Nobody knows what a batch cost, electricity included, until the monthly books close.
- **Paper records.** Bookings are in a logbook. Weights and moisture are on tally sheets. To see the queue, the storage level or a batch's history, someone has to dig through forms.

Farmers have the mirror problem. They can't see prices, rates or open slots ahead of time, so they call or show up and hope there's room.

## Modules

Each module is one vertical slice. One person can own it end to end: screens, SMS commands, logic, data, demo and docs.

The wording below uses the IRPC rice pilot. In the product, "milling" is the facility's processing step and "palay" is the crop's raw input. Both come from the crop's configuration.

**Priority levels**

- **P0, must have.** It has to work in the demo.
- **P1, if time allows.** Build it after every P0 works.
- **P2, mock only.** Show a static screen at most.

| Module                  | Purpose                                       | Main users                | Needs                        |
| ----------------------- | --------------------------------------------- | ------------------------- | ---------------------------- |
| M1. Facility Setup      | Machines, crops, places and settings          | Admin                     | None                         |
| M2. Accounts and Access | Clients, staff, and who can do what           | Everyone                  | None                         |
| M3. SMS                 | Sending, receiving and understanding texts    | Clients, bookers          | M2                           |
| M4. Language            | Hiligaynon and English everywhere             | Everyone                  | None                         |
| M5. Pricing             | Buying prices, service fees and rice prices   | Manager, clients          | M3, M4                       |
| M6. Booking             | Reserving drying and milling slots ahead      | Clients, bookers, encoder | M1, M2, M3, M4               |
| M7. Queue               | The order at the gate on the day              | Encoder, clients          | M2, M3, M6                   |
| M8. Harvest Forecast    | What will arrive, and when                    | Clients, bookers, manager | M1, M2, M3, M4               |
| M9. Palay Buying        | Quotes, prices and purchases of palay         | Clients, encoder, manager | M2, M3, M5, M10              |
| M10. Batch Records      | Digital paper forms, from the gate to storage | Encoder, manager, clients | M1, M2, M7                   |
| M11. Sales and Dispatch | Selling milled rice to first-hand buyers      | Encoder, manager, buyers  | M3, M5, M9, M10              |
| M12. Batch Costing      | Cost and margin per batch                     | Manager                   | M1, M5, M9, M10, M11         |
| M13. Capacity           | Load against capacity, in several views       | Manager                   | M1, M6, M7, M8, M9, M10, M12 |
| M14. Prescriptions      | Suggested actions                             | Manager, clients          | M3, M6, M12, M13             |

The main flow through the modules:

```
Sell offer (M9) or booking (M6) → check-in at the gate (M7) → receiving (M10)
  → price and purchase (M9, IRPC-bought palay only) → drying, storage, milling (M10)
  → sale and dispatch (M11) → cost and margin (M12)
```

### M1. Facility Setup

Every other module reads its numbers from here. Everything is editable, because some IRPC figures are still unconfirmed and because a new facility should only need new settings.

**P0, must have**

- Capacity: dryer units and how much each holds per load, drying cycle hours, mill tonnes per hour, operating hours, storage capacity (1,100 t for IRPC).
- Costs: each machine's power rating (kW), the plant's base load (power drawn on any working day, whatever the volume), electricity price per kWh, labor cost per hour.
- Planning settings: target MC, drying shrink factor, the load level that counts as "idle", and how wide the harvest-window and tonnage ranges are.
- Crops: whether the crop needs drying, its target MC, what its processing step is called (milling for rice), and its output grades and by-products.
- Varieties: days to maturity and yield per hectare.
- Places: the Philippine Standard Geographic Code (PSGC) list, so any province works.
- Demo data: IRPC as the first facility, with sample clients, co-ops and buyers.

**P2, mock only**

- Setup screens to add a facility, crop or region without a developer.

### M2. Accounts and Access

Who the clients and staff are, and what each person can do.

**P0, must have**

- Register clients: farmers, co-ops, traders, stores and institutions. Each has a name, a place and a contact phone. Farmers also have a barangay, a co-op and a language. Staff can register a walk-in or caller in seconds. Farmers can also register themselves by SMS.
- Link a booker to the clients they act for.
- The permission rules below, checked on every screen action and every SMS command. A text that isn't allowed gets a polite "you can't do that" reply.

**P1, if time allows**

- The first time someone books for a client by SMS, the client gets a text to approve the link. Links created by staff in person skip this.
- Staff only see clients who have dealt with their facility.
- Staff belong to a facility. Clients can deal with more than one facility.

**P2, mock only**

- A log of who changed which record.

**Who can do what**

| Action                                                                       | Client (SMS) | Booker (SMS)       | Encoder | Manager | Admin  |
| ---------------------------------------------------------------------------- | ------------ | ------------------ | ------- | ------- | ------ |
| Check prices and fees                                                        | Yes          | Yes                | Yes     | Yes     | Yes    |
| Book, report a planting, offer palay for sale                                | For self     | For linked clients | Anyone  | Anyone  | Anyone |
| Cancel, answer or check a booking                                            | Own bookings | Bookings they made | Yes     | Yes     | Yes    |
| Check in at the gate, run the queue                                          |              |                    | Yes     | Yes     | Yes    |
| Register clients, record batch stages, record sales                          |              |                    | Yes     | Yes     | Yes    |
| See costs and margins                                                        |              |                    |         | Yes     | Yes    |
| Set prices, override a buying price, accept suggestions, send outreach texts |              |                    |         | Yes     | Yes    |
| Change facility settings, manage staff, use the SMS simulator                |              |                    |         |         | Yes    |

Co-op leaders are bookers linked to their members. Buyers have no login; they only get texts.

### M3. SMS

The texting plumbing. Other modules plug their own commands and message templates into it.

**P0, must have**

- Read incoming texts, find the keyword command, and pass it to the module that owns it. Unknown texts get a help reply. The sender is identified by phone number.
- Send texts from message templates.
- A web page that simulates phones, so the demo never depends on a real network. Only admins can use it, and it's off when a real gateway is on.

**P1, if time allows**

- A real SMS gateway.
- Understand plain-language texts. When a text isn't a keyword command, AI reads it (Hiligaynon, English or Taglish, with sacks converted to kilos). The app replies with what it understood and saves nothing until the sender confirms.

### M4. Language

**P0, must have**

- Every web screen in Hiligaynon and English.
- Every SMS template in Hiligaynon and English.
- Each person has a language, and texts to them use it.

**P1, if time allows**

- A language switch on every screen.
- Adding a language (Cebuano, Tagalog) only takes a new translation file, SMS keywords included.

### M5. Pricing

Every price the facility sets, in one place.

**P0, must have**

- The manager sets today's prices:
  - Palay buying price: a base price at a reference MC (25% for IRPC), plus the deduction rates for damaged grains, immature grains, foreign matter and sacks.
  - Service fees: drying and milling. IRPC's current fees are ₱1.60/kg for drying and ₱3.30/kg for milling.
  - Milled rice selling price per grade.
- `PRICE` and `RATES` texts reply with today's figures.

**P1, if time allows**

- A public mobile page with today's prices.
- A screen showing price history. (Old prices are always kept, even at P0, so each batch is costed at the prices of its own day.)

### M6. Booking

Reserving a slot ahead of time, for planning. What happens on the day itself is M7.

**P0, must have**

- Book a drying or milling slot: estimated kilos, preferred date, and how many days either way the client can move. Any client can book: farmers, co-ops, or traders bringing palay for custom milling.
- Book for someone else. The booking keeps both the booker and the client who owns the palay.
- A list of upcoming bookings per service and day.
- A booking is confirmed straight away if the day still has room among confirmed bookings. Otherwise it waits for staff, who confirm it or propose another date.
- Texts for: request received, booking confirmed (with a reference code), and a new date proposed (reply to accept or decline).

**P1, if time allows**

- Change or cancel a booking by SMS.
- Booking on the web, with phone sign-in.

**P2, mock only**

- A co-op leader's view of all members' bookings.

A booking is always one of: requested, confirmed, new date proposed, arrived, cancelled, no-show.

### M7. Queue

The order at the gate on the day. Booked clients and walk-ins end up in the same line.

**P0, must have**

- Check in at the gate: find the booking by its reference code or the client's phone, or add a walk-in with no booking. Checking in marks the booking as arrived.
- One line per service: drying, milling, and palay sold to IRPC.
- A live queue screen: who's next, who's being served, and how long each has waited.
- Start and finish serving someone. Starting hands them over to receiving (M10) and texts the next few in line that their turn is near.

**P1, if time allows**

- `STATUS` by SMS replies with the client's place in line.
- An estimated wait, from the line's length and how long each service takes.

**P2, mock only**

- A big-screen queue board for the waiting area.

### M8. Harvest Forecast

Expected arrivals per day. It combines what farmers report with a forecast for everyone who hasn't reported.

**P0, must have**

- Farmers report plantings by SMS (or staff enter them): place, hectares, variety, planting date. Co-op leaders can report for members.
- Each report gets a harvest window (planting date + days to maturity, give or take a few days) and a tonnage range (hectares × yield).
- The farmer gets a text with the expected harvest window.

**P1, if time allows**

- A forecast model that predicts harvest per municipality per half-month, about 80 days ahead, from municipal planting reports.
  - It learns from the real OPA 2025 planting and harvest data: what's planted now gets harvested about 100 days later. It uses no made-up training data.
  - Predicted harvest × IRPC's usual share of each municipality = expected arrivals at IRPC.
  - The capacity page shows it as a lower-confidence layer, with error ranges and an accuracy figure measured on municipalities the model never saw.
- Import planting and harvest reports in one standard file format, so any province's data works.
- When there's no current planting report, fall back to last year's harvest × IRPC's share.

### M9. Palay Buying

IRPC buying palay from farmers, made fast and clear. Private mills win today because they quote and pay quickly.

**P0, must have**

- Quote by SMS. A farmer texts their palay's estimated MC (and kilos, if they like) and gets back an estimated price per kilo and total. The reply says the final price depends on weighing and the quality check.
- Price at receiving. From the receiving data (weight, MC, damaged, immature, foreign matter, sacks), the app works out the price the same way the paper Receiving Report does. The encoder sees it, and the farmer gets it by text.
- A purchase record for each palay IRPC buys: kilos, price per kilo, total, deductions, and the payment voucher number. The app doesn't make payments.

**P1, if time allows**

- Offer palay for sale by SMS: variety, estimated kilos, harvest date. Offers show up on a buying list and on the capacity page as expected arrivals. The manager accepts or declines.
- A manager can override a computed price, with a reason.
- Buying budget: how much of the working capital is used and how much is left.

**P2, mock only**

- Each farmer's purchase history.

### M10. Batch Records

The paper forms, made digital. A batch follows one lot of palay from the gate through drying and milling into storage, ready to sell.

**P0, must have**

- Stages: received → drying → stored → milling → milled → released → closed.
  - "Stored" means dried palay waiting in storage. "Milled" means milled rice waiting in storage. "Released" means all of it has left, picked up by the owner or sold.
  - Palay that arrives already dry, as in a milling-only booking, skips drying: received → stored.
- Receiving starts from the queue entry, so the batch is already linked to its client and booking.
- One form per stage, with the same fields as the paper forms:
  - Receiving: tally sheet and stock receipt numbers, bags, gross and net weight, variety, MC, quality sample (damaged, immature, foreign matter).
  - Drying: dryer, MC before and after, start and end time, dried weight, bags.
  - Milling: kilos in, start and end time, output by grade, by-products.
- Drying shrink and milling recovery (rice out ÷ palay in) are calculated automatically.
- Ownership: either custom service (the client's palay) or IRPC-owned (palay IRPC bought).

**P1, if time allows**

- Photo to form. The encoder photographs a paper form, AI fills in the stage form, and the encoder checks it before saving.
- Entry checks: more out than in, MC out of range, kilos that don't match the bag count.
- Clients confirm weight and MC by SMS reply after receiving and after drying.
- Storage stock by variety and age.

**P2, mock only**

- Lock closed batches. Corrections become logged amendments.

### M11. Sales and Dispatch

Selling milled rice to first-hand buyers, and tracing every sale back to its batches.

**P0, must have**

- Milled rice available to sell, by grade, from M10's storage.
- Record a sale: buyer, grade, kilos, price, and the official receipt or invoice number. The app picks the source batches, oldest first, and staff can change them. One sale can draw from several batches, and one batch can go to several buyers.
- Buyers are clients with a buyer type: wholesaler, retailer, institution, municipal drop-point, or the ₱20/kg program.
- Look up a batch's full trail by batch number, client or buyer: gate, stages, purchase and sales.

**P1, if time allows**

- Orders: a buyer reserves stock for pickup. They get a text when it's ready.
- Sales by buyer type and by place.

**P2, mock only**

- A buyer's purchase history.

### M12. Batch Costing

Cost, revenue and margin for each batch when it closes, not after month-end.

**P0, must have**

- Electricity = machine hours × machine kW × price per kWh. Machine hours come from the drying and milling start and end times.
- Labor and other direct costs, from set rates or entered per batch.
- Revenue:
  - Custom service: drying fee × wet kilos + milling fee × rice kilos.
  - IRPC-owned: the batch's share of sales (M11) − what IRPC paid for the palay (M9).
- Cost, revenue and margin per batch and per kilo.

**P1, if time allows**

- Electricity cost per kilo over time.

**P2, mock only**

- Manual meter readings, to check the estimates against real use.

### M13. Capacity

The plant manager's main page. One page with several views of the same numbers: what's coming, against what each part of the plant can handle.

Every view uses the same rules:

- Three pools: dryer (wet palay in, tonnes per day), storage (dried palay held, against 1,100 t), and mill (palay into the mill, tonnes per day).
- Each number shows where it came from (confirmed booking, accepted sell offer, declared planting, forecast) and a low–high range. Forecast data from the demo is labelled as such.
- Overloaded days are flagged with the overflow in tonnes. Idle stretches are flagged too.
- Clicking a day or bar in any view opens the same breakdown: the amount by source, the bookings behind it, and the suggestions (M14) for that day.

**P0, must have**

- **Headline numbers:** dryer and mill use for the period, overloaded days ahead, idle days ahead, and electricity cost per kilo.
- **Chart view:** expected load per day as stacked bars or areas by source, with capacity drawn as a line. Anything above the line is overflow.
- **Days view:** a grid with one row per pool and one column per day. Each cell has the amount, its range and its flag.

**P1, if time allows**

- **Season view:** a heatmap of use by month for the whole year, past months from real batches and future months from the forecast. It shows the twin peaks and the idle months at a glance.
- **Map view:** expected harvest per municipality for the next 4 to 8 weeks, as bubbles on a map. It shows where palay will come from and where to send outreach texts.
- **Today view:** a timeline per dryer and mill for today, from the queue (M7) and batch records (M10).

**P2, mock only**

- **Flow view:** arrivals → dryers → storage → mill for a chosen week, showing where the bottleneck is.
- Volume by municipality and buyer type, and a CSV export for audit.

### M14. Prescriptions

Suggested actions, worked out from the capacity numbers (M13). The manager accepts, edits or dismisses each one.

**P0, must have**

- **Move bookings off a busy day.** When the dryers are overbooked, suggest moving flexible bookings to the nearest days with room. Accepting texts the affected clients through M6.
- **Mill in full loads.** From palay in storage, suggest fewer, full-load milling days. Show the electricity cost per kilo against spreading the same amount over more half-empty days.

**P1, if time allows**

- **Store now, mill later.** At peak, send dried palay to storage and suggest milling dates in a quieter week.
- **Fill idle days.** Before an idle stretch, suggest a text with current rates and buying prices to chosen farmers, co-ops or municipalities.

**P2, mock only**

- **Plain-language summaries.** AI writes each suggestion as one or two sentences in Hiligaynon or English, using only the calculated numbers.

## Rules for every module

- **Settings, not code.** Nothing about IRPC, rice, Iloilo or Hiligaynon is hardcoded. A new facility, crop, region or language is new data.
- **AI reads, people confirm.** AI only reads texts and photos, and a person confirms the result. Every capacity, suggestion and cost number comes from fixed rules.
- **Each role sees its own part.** M2's table of who can do what applies to screens and SMS alike.
- **No official receipts.** The app never issues receipts. It only stores the receipt or invoice number.
- **Cheap to run.** It's a mobile web app, so there's nothing to install. SMS works on basic phones. It needs no new plant hardware, and meter readings are typed in.

## Not in this version

- A buyer portal or online ordering. Buyers only get texts.
- Paying farmers: payment vouchers, disbursement, accounts payable. M9 only records the voucher number.
- Issuing official receipts, an accounting ledger, or cash tracking.
- Links to the farmer registry (RSBSA), MAO records or OPAg's MoRProGRes. The data keeps IDs so these can be added later.
- Power meters, sensors or any new plant hardware.
- Forecasting beyond the planting-to-harvest model, such as weather-based or deep-learning models.
- Predicting IRPC arrivals directly. There's no dated arrival history to learn from.
- Native mobile apps and full offline mode.
- Trucking and warehouse rental.
- Running the ₱20/kg rice program. It's only a buyer type here.
- Dynamic pricing or price suggestions.
- Chatbots.
- A view across several facilities, such as a provincial dashboard. The data allows it later.
- Crops that don't follow receive → dry (optional) → store → process → dispatch, such as fresh produce that needs cold storage.
- Data Privacy Act compliance (consent, data handling, AI provider terms). This comes with the pilot.

## Open questions

**Plant figures to confirm with IRPC.** All of these are editable settings until then.

| Figure             | What we have                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------ |
| Drying capacity    | 40 t per load (feasibility study: 5 × 8 t) or 56 t (spec sheet: 5 × 10 t + 1 × 6 t)        |
| Drying cycle time  | Not recorded anywhere                                                                      |
| Mill throughput    | 400 bags/day (spec sheet) or 50 t/day (challenge form). A sample run did about 3.1 t/hour. |
| Machine power (kW) | Unknown                                                                                    |
| Electricity price  | Unknown                                                                                    |

**How exactly is the buying price worked out?** The Receiving Report shows a base price at 25% MC, minus deductions (damaged × 0.25, immature × 0.10, foreign matter, sacks). How MC above or below 25% changes the price isn't written down. Confirm with IRPC; until then, the rule is a setting.

**Will farmers accept a new date?** This decides how much the "move bookings" suggestion can do.

**How far can we trust the forecast?** It learned from one season, so we can't yet check how much timing and yield change from year to year. Added up to the province it's accurate. Per municipality per half-month it's noisy. Batad, Maasin and San Dionisio have planting and harvest totals that don't add up.

**Is IRPC's share still right?** It comes from 2021–2023 purchases, applied to 2025 harvests. Newer purchase data would settle it.

**Decisions taken from recommendations.** These came from planning recommendations that weren't explicitly confirmed:

- Dryer, storage and mill are planned as separate pools.
- The forecast starts from farmers' planting reports.
- Booking and the gate queue are separate modules.
- Palay buying and rice sales are modules of their own, with quotes and receiving prices at P0.
- Bookings belong to clients, not only farmers, so traders can book custom milling.
- Batch costing is a core feature.
- Plant staff are the primary users. Farmers come second.
- Anyone can book for someone else.
- Data entry copies the paper forms.
