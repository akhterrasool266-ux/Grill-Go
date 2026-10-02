/** `{{name}}` substitution. Unknown placeholders are removed rather than shown raw to parents. */
export function renderTemplate(text: string, vars: Record<string, unknown>): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, k: string) => (vars[k] === undefined || vars[k] === null ? '' : String(vars[k]))).replace(/[ \t]{2,}/g, ' ').trim();
}

/** Pakistan-friendly: 0300-1234567 / +92 300 1234567 / 923001234567 → 923001234567. Returns null if it cannot be a mobile number. */
export function toE164Pk(raw: string): string | null {
  const d = raw.replace(/[^\d]/g, '');
  let n = d;
  if (d.startsWith('0092')) n = d.slice(2);
  else if (d.startsWith('92')) n = d;
  else if (d.startsWith('0')) n = '92' + d.slice(1);
  else if (d.length === 10 && d.startsWith('3')) n = '92' + d;
  return /^92\d{10}$/.test(n) ? n : null;
}
