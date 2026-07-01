# FlowOps — Current State

*Last updated: 2026-07-01 (seeded from docs/development-log.md Session 14, docs/case-study.md, and git log — update this in place as state changes)*

## Status: fully built, NOT deployed. Original client did not adopt it. Actively looking for a new deployment target.

This is the single most important fact about this project. Per the dev log's own final entry
(Session 14, June 2026): **Quinn's Auction Galleries did not adopt FlowOps.** Demos were
scheduled but never resulted in floor use. Any dollar/percentage figures floating around (e.g. in
the case study / impact report) are projected/modeled estimates from the build, not measured
results from live use. The tool is complete and deployment-ready, but has never actually run in
production at a real business.

**2026-07-01 — README.md and docs/case-study.md corrected; docs/impact-report.md checked and left as-is.**
README's "in active use" line and the $33,280/year figure-as-fact were rewritten. `case-study.md`'s
opening bottom-line box and its "Results" section (§5) were also rewritten — they were written in
present-tense, success-story language ("now runs on...") that contradicted the honest admission
buried in its own §6 ("The tool was not adopted at Quinn's") and "What I learned" section. §5 is
now explicitly labeled as designed/modeled capability, not a measured result, with a pointer to §6.
`docs/impact-report.md` was read and found to already be honest end to end ("Fully built.
Technically validated. Not yet deployed in live operations," plus an explicit "What was not
validated" section) — it did not need changes.

**Root cause identified in the dev log:** the decision-maker was never sufficiently engaged
during the build. The person who felt the floor-level pain (staff/manager) was not the person who
had authority to approve adoption, and that gap was never closed.

**Current move (as of last dev log entry):** in conversation with **Ararity Auctions** (Lorton,
VA) as a new prospective deployment target. Next step per the log: conduct floor-level research at
Ararity through existing contacts *before* any outreach to leadership, to validate the problem
exists there before pitching a solution.

**New methodology going forward (explicitly logged):** confirming decision-maker buy-in before
building anything is now "step zero," for FlowOps and for every future Operations Systems Builder
project.

## What's built (fully shipped in V2, per case study / dev log / git history)

- Six-stage pipeline per physical rack: Unpacking & Sorting → Sorted → Lotting → Ready → Pickup → Completed, with business-hours-aware time thresholds and automatic "needs attention" flagging.
- Role-scoped views for 6 jobs: Admin, Front Desk, Unpacker/Sorter, Lotter, Pickup (+ a 6th role implied by "six jobs" in README, confirm which).
- Warehouse floor map (bay-level occupancy, color-coded by auction run), drag-and-drop pickup floor plan.
- Dumpster tracking with timestamped per-consigner fill entries (trash billing audit trail).
- Full-database JSON backup/restore (upsert-based, sequence-resync on restore) — built because the business needed a backup habit independent of Supabase's own tooling.
- Reports page: 4 CSV exports + backup/restore + User Guide (PDF/HTML) link.
- Realtime sync via Supabase subscriptions; role permissions enforced at edge middleware + UI from a single source of truth (`lib/roles.ts`).

## Stack

Next.js 15 · React 19 · TypeScript · Supabase (Postgres + Realtime + Auth + Storage) · Zustand · Framer Motion · Tailwind v4 · html5-qrcode. No separate backend — logic lives in the Next.js client + Postgres functions.

## Repo hygiene note

FlowOps-V1 (sibling folder) is an initial `create-next-app` scaffold with a single "Initial commit" and no further history — effectively dead. FlowOps-V2 is the real, active codebase (94 commits). `flowops-Prototype-Kimi/flowops_v2.html` is a standalone prototype file, not integrated. Worth archiving/labeling V1 and the Kimi prototype clearly so a future session (or a subagent) doesn't mistake them for current work.
