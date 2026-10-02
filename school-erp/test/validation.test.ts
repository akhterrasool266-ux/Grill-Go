import { describe, expect, it } from 'vitest';
import * as v from '@/lib/validation/common';

describe('CNIC and phone normalisation', () => {
  it('formats a 13-digit CNIC', () => expect(v.normalizeCnic('3520212345671')).toBe('35202-1234567-1'));
  it('leaves a malformed CNIC for the validator to reject', () => expect(v.normalizeCnic('12345')).toBe('12345'));
  it('accepts CNIC with dashes', () => expect(v.optCnic().safeParse('35202-1234567-1').success).toBe(true));
  it('rejects a short CNIC', () => expect(v.optCnic().safeParse('35202-123').success).toBe(false));
  it('treats blank CNIC as absent', () => expect(v.optCnic().parse('')).toBeUndefined());
  it.each([['+92 300 1234567', '03001234567'], ['0092-300-1234567', '03001234567'], ['0300-1234567', '03001234567'], ['923001234567', '03001234567']])('normalises %s', (i, o) => expect(v.normalizePhone(i)).toBe(o));
  it('rejects a too-short phone', () => expect(v.phone().safeParse('123').success).toBe(false));
  it('requires a phone', () => expect(v.phone('Mobile').safeParse('').success).toBe(false));
});

describe('form helpers', () => {
  it('bool() takes the LAST value (hidden "false" + checked "true")', () => {
    expect(v.bool().parse(['false', 'true'])).toBe(true);
    expect(v.bool().parse(['false'])).toBe(false);
    expect(v.bool().parse('on')).toBe(true);
    expect(v.bool().parse(undefined)).toBe(false);
  });
  it('uuid() rejects junk', () => { expect(v.uuid().safeParse('nope').success).toBe(false); expect(v.uuid().safeParse('2e52016d-a2a0-4984-9f20-0ee1498d4898').success).toBe(true); });
  it('date() requires a real ISO date shape', () => { expect(v.date().safeParse('2026-13-45').success).toBe(false); expect(v.date().safeParse('26/01/2026').success).toBe(false); expect(v.date().safeParse('2026-01-31').success).toBe(true); });
  it('formToObject collects repeated fields into arrays', () => {
    const fd = new FormData(); fd.append('a', '1'); fd.append('a', '2'); fd.append('b', 'x');
    expect(v.formToObject(fd)).toEqual({ a: ['1', '2'], b: 'x' });
  });
});
