/** Server-side upload checks. Never trust the browser's reported content type. */
export const MAX_UPLOAD = 10 * 1024 * 1024;

export type Sniffed = { mime: string; ext: string } | null;

export function sniffMime(b: Uint8Array): Sniffed {
  const eq = (off: number, s: string) => s.split('').every((c, i) => b[off + i] === c.charCodeAt(0));
  if (b.length >= 4 && eq(0, '%PDF')) return { mime: 'application/pdf', ext: 'pdf' };
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (b.length >= 8 && b[0] === 0x89 && eq(1, 'PNG')) return { mime: 'image/png', ext: 'png' };
  if (b.length >= 12 && eq(0, 'RIFF') && eq(8, 'WEBP')) return { mime: 'image/webp', ext: 'webp' };
  if (b.length >= 4 && eq(0, 'PK') && b[2] === 3 && b[3] === 4) return { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' };
  if (b.length >= 8 && b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) return { mime: 'application/msword', ext: 'doc' };
  return null;
}

export const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Keeps the original name readable but safe for a storage path. */
export function safeFileName(name: string): string {
  const base = name.normalize('NFKD').replace(/[^\w.\- ]+/g, '').trim().replace(/\s+/g, '_').replace(/\.{2,}/g, '.').slice(0, 80);
  return base || 'file';
}
