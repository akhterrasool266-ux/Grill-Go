import { describe, expect, it } from 'vitest';
import { validateMarks, validateStaff, validateStudents, type StudentLookups } from '@/lib/import/kinds';
import { parseDate } from '@/lib/import/engine';

const lk = (): StudentLookups => ({ classes: new Map([['class 3', 'c3']]), sections: new Map([['c3|a', 's3a']]), existingAdmissionNos: new Set(['adm-1']), existingBForms: new Set(['35202-1111111-1']) });
const H = 'Student name,Gender,Class,Section,Admission no,B-Form,Guardian name,Guardian phone\n';

describe('student import validation', () => {
  it('accepts a good row and resolves class/section ids', () => {
    const r = validateStudents(H + 'Ayesha Noor,female,Class 3,A,,,Tariq,0300-1234567\n', lk());
    expect(r.counts).toMatchObject({ total: 1, valid: 1, invalid: 0 });
  });
  it('flags unknown class, bad gender and missing guardian — with the line number', () => {
    const r = validateStudents(H + 'Bad Row,robot,Class 99,,,,,\n', lk());
    expect(r.rows[0]!.status).toBe('invalid');
    expect(r.rows[0]!.line).toBeGreaterThan(1);
    expect(r.rows[0]!.errors.length).toBeGreaterThanOrEqual(3);
  });
  it('flags a duplicate admission number already in the database', () => {
    const r = validateStudents(H + 'Dup,male,Class 3,A,ADM-1,,Tariq,03001234567\n', lk());
    expect(r.rows[0]!.status).not.toBe('valid');
  });
  it('flags a duplicate within the same file', () => {
    const r = validateStudents(H + 'One,male,Class 3,A,ADM-9,,T,03001234567\nTwo,male,Class 3,A,ADM-9,,T,03001234567\n', lk());
    expect(r.counts.valid).toBe(1);
    expect(r.rows[1]!.status).not.toBe('valid');
  });
  it('reports missing required columns', () => {
    const r = validateStudents('Name\nAli\n', lk());
    expect(r.headerErrors.length).toBeGreaterThan(0);
  });
});

describe('staff and marks import', () => {
  it('rejects a staff row without phone', () => {
    const r = validateStaff('Staff name,Phone\nSidra,\n', { codes: new Set(), cnics: new Set() });
    expect(r.rows[0]!.status).toBe('invalid');
  });
  it('marks: rejects marks above the maximum and unknown students', () => {
    const r = validateMarks('Student ID,Marks,Absent\nSTD-1,101,\nSTD-9,50,\nSTD-1,40,\n', { max: 100, students: new Map([['STD-1', 'id1']]) });
    expect(r.rows[0]!.errors.join(' ')).toMatch(/100|maximum|exceed/i);
    expect(r.rows[1]!.status).toBe('invalid');
    expect(r.rows[2]!.status).toBe('duplicate');
  });
  it('marks: an absent student needs no marks', () => {
    const r = validateMarks('Student ID,Marks,Absent\nSTD-1,,yes\n', { max: 100, students: new Map([['STD-1', 'id1']]) });
    expect(r.rows[0]!.status).toBe('valid');
  });
});

describe('date parsing', () => {
  it.each([['2016-04-21', '2016-04-21'], ['21/04/2016', '2016-04-21'], ['21-04-2016', '2016-04-21']])('%s', (i, o) => expect(parseDate(i)).toBe(o));
  it('rejects impossible dates', () => { expect(parseDate('31/02/2016')).toBeNull(); expect(parseDate('hello')).toBeNull(); });
});
