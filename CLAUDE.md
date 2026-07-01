# FlowOps — Project Brief

## Session Memory — read this first

Vlad works on this project across two machines. Before doing any work, read `memory/00-index.md`
and `memory/state.md` to pick up where the last session left off. **In particular: do not describe
this project as "deployed" or "in active use" without checking `memory/state.md` first** — the
README's framing is currently ahead of reality (see the vault for why). Check
`memory/open-questions.md` for anything that needs Vlad's input before proceeding.

At the end of any session where real changes were made (code, decisions, or new open questions),
append a short entry to `memory/session-log.md` and update `memory/state.md` and
`memory/decisions-log.md` in place if the change affects them. Keep entries short — this is a
handoff note for the next session, not a full changelog (that's what `docs/development-log.md` is
for).

## What is FlowOps?

A warehouse/floor coordination system originally built for Quinn's Auction Galleries, a
consignment and donation-resale operation. Tracks physical racks of goods through a six-stage
pipeline (Unpacking & Sorting → Sorted → Lotting → Ready → Pickup → Completed) with automatic
time-threshold flagging, role-scoped views for floor staff, a warehouse floor map, dumpster/trash
billing tracking, and full backup/restore. See `README.md` and `docs/case-study.md` for the full
narrative, and `memory/state.md` for the current, honest deployment status.

This project is one of the industry proof points under the cross-project
`../../HireView/BLUEPRINT_Operations_Systems_Builder.md` methodology (Industry 4 — Logistics &
Supply Chain Operations, applied at warehouse scale).

## Repo layout note

This is `FlowOps-V2`, the active codebase. A sibling `FlowOps-V1/` folder is an abandoned initial
scaffold — do not pull context from it. A `flowops-Prototype-Kimi/` folder alongside both is a
standalone HTML prototype, also not part of the active codebase.

## Stack

Next.js 15 · React 19 · TypeScript · Supabase (Postgres + Realtime + Auth + Storage) · Zustand ·
Framer Motion · Tailwind v4 · html5-qrcode. No separate backend service — business logic lives in
the Next.js client and Postgres functions. Role permissions enforced at both edge middleware and
UI layers from a single source of truth (`lib/roles.ts`).
