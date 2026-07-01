# FlowOps — Impact Report

**Fully built. Technically validated. Not yet deployed in live operations.**

*Quinn's Auction Galleries · Vladyslav Vashchuk · June 2026*

---

## Current status

FlowOps is a complete, deployment-ready warehouse operations platform. It was built over six weeks (94 commits, 2026-05-08 → 2026-06-17) through direct observation of and iteration against real floor workflows at Quinn's Auction Galleries — a consignment and donation-resale warehouse in the Washington D.C. metro area.

The tool was not adopted at Quinn's. Demos were scheduled but did not result in floor use. The product works. The deployment did not happen due to insufficient buy-in from the decision maker — the person who felt the operational pain on the floor was not the person who needed to approve adoption. That gap was not addressed before the tool was built.

FlowOps is ready for its first live deployment. The next target is Ararity Auctions (Lorton, VA), where floor-level research is underway before any outreach to leadership.

---

## The problem FlowOps was built to solve

Consignment and donation-resale warehouses coordinate a five-stage physical pipeline — intake, unpacking, sorting, lotting, and pickup — across multiple staff on different schedules. Without a shared system, that coordination runs on verbal relay, whiteboards, and floor-walks. The result: throughput is capped not by how fast people work, but by how fast information about what needs doing can travel between them.

Specific problems FlowOps was designed to eliminate:

- Staff walking the floor or asking around to answer "where is this consigner's stuff" or "is this rack ready to move"
- No early warning when a rack stalls in a stage — problems only surface when they're visibly in the way
- Auction deadlines tracked by memory, not by system
- No audit trail for trash/donation billing
- Unscheduled walk-in trucks requiring coordination to start from zero

---

## What was built

FlowOps replaces manual coordination with a live, role-specific shared system. Each of the six jobs on the floor (front desk, unpacker, sorter, lotter, pickup, admin) gets its own filtered queue showing exactly what needs doing next. The system adds:

- Automatic, business-hours-aware "needs attention" flags per pipeline stage — stalled racks surface themselves
- A drag-and-drop pickup floor plan and QR-code scan-to-lookup — any rack's status answered in seconds
- Automatic zone assignment, delivery completion, auction-deadline alerts, and dumpster/billing logs
- Four CSV report exports and full-database backup/restore
- Role-based access control enforced at both the route and UI level

All of this was built and tested. It functions as designed.

---

## What was not validated

No formal before/after measurement was completed. No time-motion study was run. No dollar figures were collected. The operational problems FlowOps addresses were observed directly, and the solution was designed and built against them — but live usage data does not exist because the tool was not adopted.

---

## Who can vouch for it

No formal stakeholder reference at this time. The tool is available for demonstration to any prospective deployment partner.
