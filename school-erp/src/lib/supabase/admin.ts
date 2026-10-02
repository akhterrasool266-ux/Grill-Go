import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { requiredEnv } from './server';

/**
 * Service-role client: BYPASSES Row Level Security. Server only.
 * Use for the few jobs that genuinely need it (account provisioning, webhooks,
 * outbox dispatch, public admission intake) and ALWAYS check the caller's
 * permission first. Never import this from a client component.
 */
export function createAdminClient() {
  return createClient(requiredEnv('NEXT_PUBLIC_SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
