# Database

21 migrations in `supabase/migrations/`, applied in filename order. Postgres 15+ (tested on 16).

| File | Contents |
|---|---|
| 0001 | extensions, `private` schema, `set_updated_at`, `jsonb_diff` |
| 0002 | schools, campuses, profiles, platform_admins, roles/permissions/user_roles, settings, number sequences, **audit log + trigger**, RLS helper functions and `apply_rls` |
| 0003 | academic years, terms, classes, sections, subjects, rooms, staff, teacher assignments, families, guardians, **students**, admissions, enquiries, documents, promotions |
| 0004 | student/staff attendance, device events, **timetable** (unique indexes prevent teacher/room/section clashes) |
| 0005 | **fees** (categories, structures, assignments, discounts, invoices, payments, allocations, refunds, closings, intents, gateway events), finance (accounts, expenses, transactions, general ledger, journal with balance trigger) |
| 0006 | grading systems and bands (no overlapping ranges), exams, marks (+ lock guard), result cards |
| 0007 | HR: salary structures, loans, payroll runs/items, leave |
| 0008 | library, transport, hostel, homework, notification templates/logs/preferences/push, announcements, calendar, CMS, plans/subscriptions/flags/usage, support tickets, `plan_limit`/`feature_enabled`/`enforce_limit` |
| 0009 | permission catalogue, role templates, `bootstrap_school()`, `get_setting` |
| 0010 | **fee RPCs** (generate invoices, collect, refund, adjust, cancel, late fines, close day, defaulters, reminders, online completion) |
| 0011 | attendance/QR, timetable conflict check, admissions → student, marks, results, publish, promotion |
| 0012 | payroll, leave decisions, library issue/return/renew, expenses, journal posting, dashboard, `my_context`, global search, notification claim/finish, `provision_user`, `submit_online_admission` |
| 0013 | storage buckets + policies |
| 0014–0015 | `create_student` (with sibling detection), discipline, `create_staff` |
| 0016 | reference data (classes/sections/rooms/periods) readable by any user of the campus |
| 0017 | report functions |
| 0018 | auto document numbers, `queue_announcement` |
| 0019 | driver route roster and route attendance |
| 0020 | usage metering, `queue_custom_message` |
| 0099 | table/column grants, revokes on money tables, execute grants (**keep last**) |

## Conventions

- `school_id uuid not null default private.current_school_id()` on every tenant table; campus tables add `campus_id` and composite FKs `(id, campus_id)` so a child can't point at another campus's parent.
- Soft states instead of deletes for anything with history (students `status`, invoices `cancelled`).
- Numbers (`STD-0001`, `RCT-0007`, `ORD`…) come from `private.next_number(key)` — atomic, per school, optionally reset yearly; format editable in Settings → Numbering.
- Generated columns for derived money (`fee_invoices.net/total/balance`) so they can't drift.
- Every public function that accepts user input is either `SECURITY INVOKER` (RLS applies) or `SECURITY DEFINER` with its own permission check and a pinned `search_path`.
- Functions meant only for the server (`claim_notifications`, `provision_user`, `submit_online_admission`, `bump_usage`, …) are revoked from `anon`/`authenticated` and granted to `service_role`.

## Backups

Not automatic — see README §8.
