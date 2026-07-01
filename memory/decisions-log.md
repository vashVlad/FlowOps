# FlowOps — Decisions Log

Append-only. Newest at top.

---

**2026-07-01 — README.md and case-study.md rewritten for honesty; impact-report.md left unchanged (already honest).**
Vlad's instruction, extended after reviewing all three docs: read this the way a business owner evaluating the work would, and fix whatever doesn't hold up. README's "in active use" and the $33,280 figure were corrected first. On review, case-study.md's headline and results section had the same problem — present-tense success framing at the top, directly contradicted by an honest admission five sections later that the tool was never adopted. Fixed to be consistent throughout: headline and §5 now clearly frame the $33,280 figure as a modeled/unmeasured planning estimate, not a result, with an explicit pointer to §6 for the real outcome. impact-report.md was checked and already stated the honest status up front with no contradiction — no edit needed there.

**2026-06 (Session 14) — "Step zero" for every future project: confirm decision-maker buy-in before building anything.**
Direct consequence of Quinn's not adopting FlowOps despite a fully working, well-received (at the floor level) build. The person who felt the pain wasn't the person who could approve deployment, and that gap was never closed during the build. This is now treated as a methodology change for FlowOps's next target (Ararity Auctions) and for future Operations Systems Builder projects generally (see BLUEPRINT in the HireView folder).

**2026-06 (Session 14) — Documentation updated to state the honest outcome rather than a projected one.**
Explicit decision to correct the record in the dev log even though case-study/impact-report framing elsewhere still reads as a success story. (Note: as of this vault's creation, README.md still says "in active use" — that line was not caught in this update. Flagged in open-questions.md.)

**Session 13 — Backup/restore built as upsert-based, never delete.**
Needed to be safe to run against a live database. Restore uses upsert by primary key; a sequence-resync step (`MAX(id) + 1`) runs after restore to prevent new-record ID collisions with restored rows.

**Session 13 — Close Auction Cycle feature removed, replaced by manual workflow.**
Added complexity without adding clarity; staff already understood the manual process it was replacing.

**Earlier sessions — Role permissions enforced at both edge middleware and UI layer, from one source of truth (`lib/roles.ts`).**
Avoids permission logic drifting between server and client.

**Earlier sessions — No separate backend service; business logic lives in Next.js client + Postgres functions.**
Simplicity given the operation's scale (5-8 staff, single warehouse).
