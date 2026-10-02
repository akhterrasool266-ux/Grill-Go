export interface Gateway {
  id: 'jazzcash' | 'easypaisa' | 'card';
  label: string;
  /** Enabled only when credentials exist AND callbacks can be verified. */
  enabled(): boolean;
  disabledReason?: string;
}
