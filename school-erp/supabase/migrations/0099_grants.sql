-- 0099 · Table + function privileges. Runs last. RLS (not these grants) is the
-- row-level gate; grants only remove capabilities that must never exist.
set search_path = public, extensions;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Tables that clients may only READ (writes happen inside SECURITY DEFINER functions).
revoke insert, update, delete on
  fee_invoices, fee_invoice_items, payments, payment_allocations, refunds, cash_closings,
  payment_intents, transactions, journal_entries, journal_lines,
  payroll, payroll_items, payroll_runs, student_attendance, notification_logs, vehicle_positions,
  attendance_device_events, plans, subscriptions, feature_flags, usage_counters, promotions
from authenticated;
revoke insert, update, delete on audit_logs from authenticated, service_role;
revoke insert, delete on profiles from authenticated;       -- accounts are created server-side
revoke insert, update, delete on permissions from authenticated;
revoke all on sync_receipts from authenticated;                -- only the sync functions (security definer) touch it
revoke delete on schools from authenticated;
revoke insert, delete on notifications from authenticated;
revoke update on number_sequences from authenticated;
grant update (prefix, padding, reset_yearly) on number_sequences to authenticated;

-- Column-level: users edit cosmetic profile fields only; school/id/email are fixed.
revoke update on profiles from authenticated;
grant update (full_name, phone, avatar_path, language, theme, preferences, is_active) on profiles to authenticated;
revoke update on result_cards from authenticated;
grant update (teacher_remarks, principal_remarks) on result_cards to authenticated;
revoke update on schools from authenticated;
grant update (name, short_name, logo_path, favicon_path, address, city, province, phone, email, website,
              timezone, currency, date_format, default_language) on schools to authenticated;
revoke update on notifications from authenticated;
grant update (read_at) on notifications to authenticated;

-- Functions: nothing callable anonymously; authenticated may call RPCs (each one
-- checks permissions itself); a short list is reserved for the server's service role.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.bootstrap_school(text, text, text, text, text) from authenticated;
revoke execute on function public.complete_online_payment(text, text, text, numeric) from authenticated;
revoke execute on function public.log_audit_as(uuid, uuid, text, text, text, jsonb, jsonb) from authenticated;
revoke execute on function public.claim_notifications(int, uuid), public.finish_notification(uuid, text, text, text, text),
  public.update_delivery_status(text, text, text, text), public.provision_user(uuid, uuid, text, text, text, text[], uuid[], jsonb),
  public.submit_online_admission(text, jsonb) from authenticated;
revoke execute on function public.bump_usage(uuid, text, int), public.within_limit(uuid, text, int) from authenticated;
alter default privileges in schema public revoke execute on functions from public, anon;
