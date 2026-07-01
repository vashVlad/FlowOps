# FlowOps — Development Log

*Reconstructed from git history (94 commits, 2026-05-08 → 2026-06-17).*
*Format per blueprint: Date · What · Why · Problems · Solutions · What's Next*

---

## SESSION 1 — 2026-05-08
**WHAT I BUILT OR CHANGED:**
Initial FlowOps commit. Core scaffold: Next.js + Supabase setup, delivery tracking, rack cards, J-Number system, manual rack codes, rack edit/delete, zone assignment to deliveries, editable notes on delivery detail, warehouse floor layout.

**WHY I MADE THIS DECISION:**
The warehouse had no system of record. Starting with deliveries and racks as the core entities — the two things every worker touches every day.

**PROBLEMS ENCOUNTERED:**
J-Number (warehouse-assigned consigner ID) wasn't in the original schema. Workers reference consigners by J-Number on the floor, not by name.

**HOW I SOLVED THEM:**
Replaced delivery code with J-Number across all UI. Added it as a first-class field on delivery and rack cards.

**WHAT'S NEXT:**
Build out zone management and operational intelligence (holds, notes, auction dates).

---

## SESSION 2 — 2026-05-08
**WHAT I BUILT OR CHANGED:**
Business-hours operational time engine (`lib/businessTime.ts`). Zone quick actions. Rack form reorder and card cleanup.

**WHY I MADE THIS DECISION:**
Naive date-diff was flagging racks as "stuck" just because they sat over a weekend. A warehouse that runs Mon–Fri 9–6 needs time tracking that reflects that reality, not wall-clock time.

**PROBLEMS ENCOUNTERED:**
Calculating business hours across arbitrary date ranges requires handling weekends, daily cutoffs, and partial days — not a simple subtraction.

**HOW I SOLVED THEM:**
Built a dedicated business-time utility that iterates over calendar days, filters non-working days/hours, and accumulates only valid working minutes. All "time in stage" calculations now route through this single engine.

**WHAT'S NEXT:**
Operational intelligence layer — holds, auction dates, consigner directory, intake forecasting.

---

## SESSION 3 — 2026-05-11
**WHAT I BUILT OR CHANGED:**
Operational intelligence: hold state, auction color dates, notes, photos, item count, consigner directory, intake forecasting. Delivery outcome tracking (donation/trash/sellable %). QR label redesign. Stage thresholds (16h lotting, 24h unpacking). Worker role restrictions (hide Reports nav, block reports page). CSV export improvements (auction date, outcome % columns). Realtime notes, connection status indicator.

**WHY I MADE THIS DECISION:**
The core pipeline existed but had no "brain." Staff needed to be able to flag a rack as intentionally paused (hold), managers needed early warning of overloaded stages, and the business needed a billing trail for trash/donation splits.

**PROBLEMS ENCOUNTERED:**
Hold state and "needs attention" state looked the same without an explicit distinction. Intake forecasting required cross-referencing scheduled deliveries against current lotting load — data that spans two different stores.

**HOW I SOLVED THEM:**
Modeled holds as a first-class status with a reason field, explicitly excluded from "needs attention" alerting. Intake forecast (`buildIntakeForecast`) computes the risk score by joining delivery schedule data against live rack counts.

**WHAT'S NEXT:**
Mixed-consigner racks, auto PU zone assignment, zone floor map.

---

## SESSION 4 — 2026-05-12 to 2026-05-13
**WHAT I BUILT OR CHANGED:**
Mixed-consigner rack support (`rack_consigners` table). Auto-assign PU zone when a rack advances to pickup. Zone-delivery relationship flipped to many-zones-per-delivery. Mobile optimization pass. Delivery workflow overhaul (status steps, clickable cards, sorting, edit, zone in racks, notes).

**WHY I MADE THIS DECISION:**
Discovered that a single physical rack can contain goods from more than one consigner — the original one-to-one rack-consigner model didn't match reality on the floor. PU zone assignment was a manual step that was always the same action; automating it removed a consistent friction point.

**PROBLEMS ENCOUNTERED:**
Flipping the zone-delivery relationship required a DB migration and updates to all downstream queries. Mixed-consigner racks needed a junction table without breaking the existing consigner lookup flow.

**HOW I SOLVED THEM:**
Added `rack_consigners` junction table via migration. Zone-delivery flip handled as a single migration with data backfill. Auto-PU assignment wired into the `advanceStatus` store action as a side effect.

**WHAT'S NEXT:**
Pipeline simplification — the intake/unpacking/sorting split isn't matching how staff actually work.

---

## SESSION 5 — 2026-05-14
**WHAT I BUILT OR CHANGED:**
**Pipeline simplification: collapsed intake/unpacking/sorting → single "Unpacking & Sorting" stage.** Dashboard zone map redesign. Zone detail purpose picker.

**WHY I MADE THIS DECISION:**
One week of real use revealed that staff don't work in separate intake, unpacking, and sorting steps — they move from truck to sorted in one continuous motion. The multi-stage model was creating friction, not clarity. The coarsest model that's still useful was the right call.

**PROBLEMS ENCOUNTERED:**
Existing rack records and history events referenced the old stage names. UI, thresholds, and filter logic all referenced the collapsed stages.

**HOW I SOLVED THEM:**
Single migration to rename stages + update all references. Updated `lib/timeTracking.ts` thresholds to reflect the new single-stage model.

**WHAT'S NEXT:**
Auction color system, zones floor map, print queue.

---

## SESSION 6 — 2026-05-15 to 2026-05-18
**WHAT I BUILT OR CHANGED:**
Auction color system (color tags on racks/zones, color filter, zone preset colors, color-coded rack chips). Zones floor map with rack chips. Sorting room KPI on dashboard. Bulk label print queue with store, badge, and creation checkboxes. Sorted rack creation improvements.

**WHY I MADE THIS DECISION:**
Auction runs are color-coded in the physical warehouse — racks tagged for the same auction share a color. Without this, the system couldn't reflect how staff actually categorize and stage goods for specific auction dates.

**PROBLEMS ENCOUNTERED:**
Auction color had to display consistently everywhere (rack cards, zone map, PU floor plan, dashboard) without re-entering the color-to-date mapping on each record individually.

**HOW I SOLVED THEM:**
Built a single global `auctionColorDates` store — one date per color, set once by admin, referenced everywhere that color appears.

**WHAT'S NEXT:**
Role-based access system, PU drag-and-drop floor plan.

---

## SESSION 7 — 2026-05-20
**WHAT I BUILT OR CHANGED:**
**Role-based access system: 6 roles (admin, front desk, unpacker, sorter, lotter, pickup), nav filtering, role switcher, admin UI, role-specific home screens.** PU drag-and-drop floor plan with DB-persisted slot positions. Dedicated `/pickup` route → PU zone. Dashboard efficiency card. Label overflow fix. Rack detail advance/hold/revert gating.

**WHY I MADE THIS DECISION:**
A single shared view was creating noise — a sorter seeing the full admin dashboard gets no useful information from it. Each job needs a filtered, purpose-built view. The PU floor plan was driven by the observation that pickup staff think spatially ("where is the rack in the bay"), not in status terms.

**PROBLEMS ENCOUNTERED:**
Role permissions needed to be enforced at both the route level (middleware) and the UI level (nav, actions, filters) from a single source of truth, not two separate systems that could drift. Drag-and-drop positions needed to persist across sessions and stay in sync across devices.

**HOW I SOLVED THEM:**
`lib/roles.ts` as the single source of truth, consumed by both `middleware.ts` (route guards) and UI components (nav filtering, action gating). PU slot positions stored in Supabase, synced via realtime subscriptions.

**WHAT'S NEXT:**
Role permission fine-tuning based on observed floor usage.

---

## SESSION 8 — 2026-05-21 to 2026-05-28
**WHAT I BUILT OR CHANGED:**
Mobile layout fixes (rack detail, lotting page). Rack detail UX (action layout, consigner dropdown, completion deletes rack row while preserving history). Print queue UX improvements. Rack form improvements.

**WHY I MADE THIS DECISION:**
The app is used on phones on the warehouse floor. Layout issues on mobile aren't cosmetic — they block the core workflow. Deleting completed racks from the active list while keeping history was needed to keep active views clean without losing the audit trail.

**PROBLEMS ENCOUNTERED:**
Rack completion (delete from active) needed to preserve the full `rack_events` history for stage-duration reporting, while removing the rack row from all active queries.

**HOW I SOLVED THEM:**
Completion deletes the `racks` row; `rack_events` are keyed by rack ID and retained indefinitely. CSV stage-duration export queries `rack_events` directly, independent of whether the parent rack still exists.

**WHAT'S NEXT:**
Zones floor plan polish, auction color dates UI, UX cleanup pass.

---

## SESSION 9 — 2026-06-01 to 2026-06-02
**WHAT I BUILT OR CHANGED:**
Zones layout: floor plan hallways, PU complete button, role & nav improvements. Auction color date UI (set/edit per color). General UX fixes and improvements.

**WHY I MADE THIS DECISION:**
The zones floor map needed hallway separators to match the physical layout of the warehouse — without them, the map didn't communicate spatial relationships between bays accurately.

**PROBLEMS ENCOUNTERED:**
Auction color dates had to be settable once and reflected everywhere without each rack/zone needing its own date field.

**HOW I SOLVED THEM:**
Global `auctionColorDates` panel on the admin dashboard. One set action updates the store; all components that render a color read the date from the same store key.

**WHAT'S NEXT:**
Role permission fine-tuning — six separate commits needed to get per-role access right.

---

## SESSION 10 — 2026-06-03
**WHAT I BUILT OR CHANGED:**
Intensive role permission fine-tuning: restricted filter pills to role-allowed statuses, removed zones access for sorter and lotter roles, allowed lotters to create racks, allowed all advance-capable roles to revert status, clamped rack filter on init, replaced inline rack form with link to `/unpack`, showed single-status filter pill for single-status roles, hid Print Queue nav from unpacker, added Ready filter for unpacker and sorter, hidden held racks from lotting queue.

**WHY I MADE THIS DECISION:**
After watching each role use the system, it became clear that the initial role definitions were too coarse. A sorter seeing zone access adds confusion. A lotter who can't create racks has to interrupt someone else. Each of these commits was a direct response to observed friction, not a planned feature.

**PROBLEMS ENCOUNTERED:**
Six separate permission issues surfaced in one day of observation — evidence that role scoping was under-specified in the initial design.

**HOW I SOLVED THEM:**
Each issue fixed independently and immediately, each as its own commit. `lib/roles.ts` updated for each, with both middleware and UI consuming the change automatically.

**WHAT'S NEXT:**
QR scanner, custom consigner option, search improvements.

---

## SESSION 11 — 2026-06-06 to 2026-06-10
**WHAT I BUILT OR CHANGED:**
Enhanced search (zone cards, relevance ranking, color-prefix match). Rack creation UX overhaul (delivery picker collapse, status selector, iOS fixes). Nav icon updates. QR scanner page (`/scan`) for sorter, unpacker, and pickup roles. Dumpster fill-tracking page for trash billing. J-Number persistence for consigners added on unpack page. Auto-format Rack ID input (uppercase, `/` separator). Lotters given QR scanner access.

**WHY I MADE THIS DECISION:**
QR scan-to-lookup was the missing piece for floor-level speed — typing a rack code on a phone in a warehouse is slow and error-prone. Dumpster tracking was needed to give the business an auditable billing trail for trash charges, replacing informal estimation.

**PROBLEMS ENCOUNTERED:**
iOS camera permissions and QR decoding behavior differ from Android/desktop. Dumpster entries needed to tie back to specific deliveries for per-consigner billing, not just be a generic log.

**HOW I SOLVED THEM:**
Used `html5-qrcode` with iOS-specific constraints. Dumpster entries carry an optional delivery reference; the delivery detail page computes donation/trash/sellable % from these entries.

**WHAT'S NEXT:**
Standalone consigner creation, role-route gap fixes, backup/restore.

---

## SESSION 12 — 2026-06-11 to 2026-06-12
**WHAT I BUILT OR CHANGED:**
Standalone consigner creation (create a consigner record before any delivery exists). Fixed pickup page issues. Closed remaining role-route access gaps. Double-space treated as literal space in Rack ID input.

**WHY I MADE THIS DECISION:**
The warehouse needs to reference a consigner by name/J-Number before their first formal delivery is logged. Without standalone consigner creation, staff had to create a dummy delivery just to attach a consigner name — wrong model.

**PROBLEMS ENCOUNTERED:**
Role-route gaps: some pages were reachable via direct URL even when the role shouldn't have access (fail-open timing issue in role-loading state).

**HOW I SOLVED THEM:**
Added standalone `consigners` table for pre-delivery records. Route guards tightened; loading state now blocks render until role is confirmed, not just until the component mounts.

**WHAT'S NEXT:**
Full backup/restore, user guide, final nav polish.

---

## SESSION 13 — 2026-06-14 to 2026-06-17
**WHAT I BUILT OR CHANGED:**
Full-database JSON backup/restore on Reports page. User Guide (PDF) linked from Reports. Removed Close Auction Cycle feature (replaced by manual workflow). Added User Guide link to Reports. Removed User Guide link from profile dropdown (consolidated to Reports). Final nav cleanup.

**WHY I MADE THIS DECISION:**
The business needed a backup habit they control and understand, independent of infrastructure. A human-readable JSON export/import gives them a recoverable snapshot without depending on Supabase's own backup tooling. The Close Auction Cycle feature added complexity without adding clarity — the manual process it was replacing was already understood by staff.

**PROBLEMS ENCOUNTERED:**
Restore had to be upsert-based (never delete) to be safe to run against a live database. Restoring old records could also leave DB sequences behind the highest restored ID, causing new records to collide with restored ones.

**HOW I SOLVED THEM:**
Restore uses `upsert` (insert or update by primary key). After restore, a sequence-resync step sets each table's sequence to `MAX(id) + 1`, preventing ID collisions on future inserts.

**WHAT'S NEXT:**
Global search UX pass. Fix Reports-page role-restriction edge case. Week-over-week throughput analytics. Consigner-facing notifications.

---

---

## SESSION 14 — June 2026

**WHAT I BUILT OR CHANGED:**
Project status updated to reflect actual deployment outcome.

**WHY I MADE THIS DECISION:**
Quinn's did not adopt FlowOps. Demos were scheduled but did not result in floor use. The tool remains fully built and deployment-ready. Documentation updated to reflect the honest current state rather than a projected outcome.

**PROBLEMS ENCOUNTERED:**
Decision maker was not sufficiently engaged before or during the build. The person who felt the pain on the floor was not the person who needed to approve adoption. That gap was never closed — which meant a fully working tool had no path to deployment.

**HOW I SOLVED THEM:**
Not yet solved. The lesson is structural: confirming decision-maker buy-in before building is not optional. Identifying who can say yes to deployment — and getting that yes to the problem before any solution is built — is now step zero of the methodology for every future project.

**WHAT'S NEXT:**
Identifying a new deployment target. Currently in conversation with Ararity Auctions in Lorton, VA. Next step: conduct floor-level research at Ararity through existing contacts before any outreach to leadership. Validate that the problems FlowOps solves exist there before pitching anything.

---

*Last updated: 2026-06-30*
*Total: 94 commits across 13 build sessions, 2026-05-08 → 2026-06-17*
