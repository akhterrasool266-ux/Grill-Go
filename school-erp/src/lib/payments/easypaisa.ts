import type { Gateway } from './gateway';

/**
 * Easypaisa is deliberately switched OFF. Its redirect callback is not signed, so a forged request could mark a
 * fee as paid. It can be enabled only after the callback handler confirms every payment with Easypaisa's
 * transaction-inquiry API (server-to-server) before calling complete_online_payment. See docs/payments.md.
 */
export const easypaisa: Gateway = { id: 'easypaisa', label: 'Easypaisa', enabled: () => false, disabledReason: 'Needs server-side transaction-inquiry verification before it can be enabled safely.' };
