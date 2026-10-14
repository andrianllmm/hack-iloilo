# 0001: Focus on supply-capacity matching

- **Status:** Proposed
- **Date:** 2026-10-14

## Context

The IRPC challenge asks for a broad platform: booking, queue, pricing, batch costing, a harvest forecast, and farmer-to-buyer traceability. Three teams are working on this problem.

Most of IRPC's pain points trace back to one cause: **IRPC can't see or shape when palay arrives.**

- **At peak:** congestion, slow procurement, and farmers waiting.
- **Off-season:** dryers and mill sit idle while fixed costs and power keep running (electricity is 24–28% of income).
- **Paper workflows:** the queue, cost per batch, and incoming harvest are only visible after the fact.
- **The result:** losses in 2024–2025. The feasibility study's ₱46M revenue assumes 180 evenly loaded drying days, which seasonal harvests can't deliver.

> At harvest, farmers wait for the machines. Off-season, the machines wait for farmers. IRPC pays for both.

## Decision

Frame the project as **filling idle capacity**, with **utilization** as the headline metric.

| Layer                     | Scope                                                                      | Role                                                      |
| ------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------- |
| Basic requirements (lean) | Booking (SMS and web) → queue → batch record → dispatch to buyer           | Needed for challenge fit; other teams will build the same |
| What sets us apart        | Harvest forecast → capacity view → prescription cards                      | Main focus of the pitch                                   |
| Supporting                | Per-batch cost estimate, thin traceability (batch ID through to buyer)     | Covers the cost and traceability success metrics          |
| Roadmap                   | Buyer portal, full real-time costing, farmer registry and MoRProGRes links | Shows phasing                                             |

**Users:** plant manager (primary), farmers (secondary, as the supply lever), buyers (only at dispatch).

**Test for any feature:** does it reduce idle days or peak backlog? If not, put it on the roadmap.

## Why

- **Matches the brief:** "Filling Idle Capacity" is first in the challenge title, and higher utilization is the first success metric.
- **Phasing is allowed:** the form invites a priority module first, and booking and queue is its first example.
- **Pilot fit:** the Pototan cooperative pilot happens at peak harvest, which is where booking and queue matter most.
- **Stands out against the other two teams:** they will likely pitch feature lists. We pitch a diagnosis, a forecast and prescriptions, and evidence from IRPC's own financials.

## Risks

- **Thin forecast data:** one year of OPA data and no procurement history yet. Use a rule-based model with fitted lags, label ranges honestly, and keep the forecast on top of the working flow rather than as the centerpiece.
- **Conflicting capacity figures:** 40 t vs 56 t per drying load. Confirm with IRPC.
- **Another team may go after forecasting too.** If so, lean on validation and evidence to stand out.
- **Hard constraints:** SMS, English (Hiligaynon deferred), Data Privacy Act compliance, and no replacing official receipts.

## Next steps

1. Talk to Aileen Tanalgo (IRPC): confirm capacity and peak months, check whether farmers would accept assigned slots, and request the 2021–2023 procurement data and the buyer list.
2. Chart monthly revenue against fixed costs from the 2024–2026 financial statements.
3. Find out what the other two teams are building.
