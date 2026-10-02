import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from '@/lib/csv';
import { safeFileName, sniffMime } from '@/lib/files';

describe('csv', () => {
  it('round-trips quotes, commas and newlines', () => {
    const rows = [['name', 'note'], ['Ali, Jr.', 'said "hi"\nbye']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
  it('neutralises spreadsheet formula injection', () => {
    const out = toCsv([['=HYPERLINK("http://evil")', '+1', '-2', '@x', 'ok']]);
    for (const bad of ['=HYPERLINK', '+1', '-2', '@x']) expect(out).toContain("'" + bad);
    expect(out).toContain(',ok');
  });
  it('does not mangle real numbers', () => expect(toCsv([[-5, 12]])).toContain('-5,12'));
  it('writes a UTF-8 BOM so Excel reads Urdu', () => expect(toCsv([['اردو']]).charCodeAt(0)).toBe(0xfeff));
  it('skips blank lines and handles CRLF', () => expect(parseCsv('a,b\r\n\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]));
});

describe('upload sniffing', () => {
  const bytes = (...n: number[]) => new Uint8Array(n);
  it('detects PDF, JPEG, PNG', () => {
    expect(sniffMime(new TextEncoder().encode('%PDF-1.7'))?.ext).toBe('pdf');
    expect(sniffMime(bytes(0xff, 0xd8, 0xff, 0xe0))?.ext).toBe('jpg');
    expect(sniffMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.ext).toBe('png');
  });
  it('rejects an executable renamed to .jpg', () => expect(sniffMime(bytes(0x4d, 0x5a, 0x90, 0x00, 0x03, 0, 0, 0))).toBeNull());
  it('rejects HTML / SVG with scripts', () => expect(sniffMime(new TextEncoder().encode('<svg onload=alert(1)>'))).toBeNull());
  it('rejects empty input', () => expect(sniffMime(new Uint8Array())).toBeNull());
  it('sanitises file names (no path traversal)', () => {
    expect(safeFileName('../../etc/passwd')).not.toMatch(/[\\/]/);
    expect(safeFileName('../../etc/passwd')).not.toContain('..');
    expect(safeFileName('')).toBe('file');
    expect(safeFileName('Result Card (final).pdf')).toBe('Result_Card_final.pdf');
  });
});
