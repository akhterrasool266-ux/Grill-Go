import { NextResponse } from 'next/server';
import { getCtx } from '@/lib/auth/session';
import { templateCsv } from '@/lib/import/engine';
import { FEE_COLS, MARKS_COLS, STAFF_COLS, STUDENT_COLS } from '@/lib/import/kinds';

const T = {
  students: { cols: STUDENT_COLS, ex: [['Ayesha Noor', 'female', '2016-04-21', 'Class 3', 'A', '', '12', '35202-1234567-1', 'Muhammad Tariq', '', 'Muhammad Tariq', '0300-1234567', 'father', '', '12-B Johar Town', 'Lahore', 'B+', '2026-04-01'], ['Hamza Khan', 'male', '2017-09-02', 'Class 2', 'B', '', '5', '', 'Imran Khan', '', 'Imran Khan', '0321-7654321', 'father', '', '', 'Lahore', '', '']] },
  staff: { cols: STAFF_COLS, ex: [['Sidra Parveen', 'female', '35202-1234567-1', '0300-1234567', '', 'Teacher', 'Languages', '2024-08-01', 'M.A., B.Ed', 'permanent', '']] },
  marks: { cols: MARKS_COLS, ex: [['STD-0001', '78', 'no', ''], ['STD-0002', '', 'yes', 'Absent']] },
  fees: { cols: FEE_COLS, ex: [['Class 3', 'TUITION', '4500', 'monthly'], ['', 'ANNUAL', '5000', 'once']] },
} as const;

export async function GET(_r: Request, { params }: { params: Promise<{ kind: string }> }) {
  if (!(await getCtx())) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const t = T[(await params).kind as keyof typeof T];
  if (!t) return NextResponse.json({ error: 'Unknown template' }, { status: 404 });
  return new Response(templateCsv([...t.cols] as never, t.ex.map((r) => [...r])), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${(await params).kind}-import-template.csv"` } });
}
