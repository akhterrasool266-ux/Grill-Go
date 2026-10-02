'use client';
import { useState, useTransition } from 'react';
import { runImport, type ImportOutcome } from '@/app/actions/import';
import { buttonClass } from '@/components/ui/button';
import { Alert, Badge, Card, CardBody, CardHeader, TableWrap, Td, Th, statusTone } from '@/components/ui/primitives';

export function ImportWizard({ kind, campuses, examSubjects }: { kind: 'students' | 'staff' | 'marks' | 'fees'; campuses?: { value: string; label: string }[]; examSubjects?: { value: string; label: string }[] }) {
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [campus, setCampus] = useState('');
  const [es, setEs] = useState('');
  const [out, setOut] = useState<ImportOutcome | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const call = (commit: boolean) => start(async () => {
    setErr(null);
    const r = await runImport({ kind, csv, commit, campus_id: campus || undefined, exam_subject_id: es || undefined });
    if (r.ok && r.data) setOut(r.data); else if (!r.ok) setErr(r.error);
  });
  const c = out?.report.counts;
  const done = out?.committed;

  return (
    <div className="space-y-4">
      <Card><CardBody className="grid gap-4 sm:grid-cols-2">
        {campuses && campuses.length > 0 && kind !== 'marks' && (
          <label className="block space-y-1 text-sm font-medium">Campus<select className="input" value={campus} onChange={(e) => setCampus(e.target.value)}><option value="">Select campus…</option>{campuses.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
        )}
        {kind === 'marks' && (
          <label className="block space-y-1 text-sm font-medium sm:col-span-2">Exam · class · subject<select className="input" value={es} onChange={(e) => setEs(e.target.value)}><option value="">Select…</option>{(examSubjects ?? []).map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
        )}
        <label className="block space-y-1 text-sm font-medium sm:col-span-2">CSV file
          <input type="file" accept=".csv,text/csv" className="input" onChange={async (e) => {
            const f = e.target.files?.[0]; setOut(null); setErr(null);
            if (!f) return;
            if (f.size > 1_400_000) { setErr('That file is too large (max 1.4 MB).'); return; }
            setFileName(f.name); setCsv(await f.text());
          }} />
          <span className="block text-xs font-normal text-muted">Excel users: File → Save As → “CSV UTF-8”. {fileName && `Loaded: ${fileName}`}</span>
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <button type="button" disabled={!csv || pending} onClick={() => call(false)} className={buttonClass({})}>{pending && !done ? 'Checking…' : 'Check file'}</button>
        </div>
      </CardBody></Card>

      {err && <Alert tone="bad">{err}</Alert>}
      {out && !done && (
        <>
          {out.report.headerErrors.map((h) => <Alert key={h} tone="bad">{h}</Alert>)}
          {out.report.unknownHeaders.length > 0 && <Alert tone="warn">These columns are not used and will be ignored: {out.report.unknownHeaders.join(', ')}</Alert>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Rows in file" value={c!.total} /><Tile label="Ready to import" value={c!.valid} tone="ok" /><Tile label="Have errors" value={c!.invalid} tone={c!.invalid ? 'bad' : undefined} /><Tile label="Duplicates" value={c!.duplicate} tone={c!.duplicate ? 'warn' : undefined} />
          </div>
          <Card>
            <CardHeader title="Row check" description="Nothing is saved until you press Import. Rows with errors are skipped, never half-imported." />
            <TableWrap><thead><tr><Th>Row</Th><Th>Status</Th><Th>Data</Th><Th>Problem</Th></tr></thead><tbody>
              {out.report.rows.map((r) => (
                <tr key={r.line}><Td className="tabular">{r.line}</Td><Td><Badge tone={statusTone(r.status === 'valid' ? 'paid' : r.status === 'duplicate' ? 'partial' : 'failed')}>{r.status}</Badge></Td><Td className="max-w-[16rem] truncate text-muted">{r.preview}</Td><Td className="text-bad">{r.errors.join(' ')}</Td></tr>
              ))}
            </tbody></TableWrap>
            {c!.total > out.report.rows.length && <p className="px-4 py-3 text-xs text-muted">Showing the first {out.report.rows.length} rows.</p>}
          </Card>
          <button type="button" disabled={pending || c!.valid === 0 || out.report.headerErrors.length > 0} onClick={() => call(true)} className={buttonClass({ size: 'lg' })}>
            {pending ? 'Importing…' : `Import ${c!.valid} valid row${c!.valid === 1 ? '' : 's'}`}
          </button>
        </>
      )}
      {done && (
        <Alert tone={done.failed.length ? 'warn' : 'ok'} title={`Imported ${done.created} row${done.created === 1 ? '' : 's'}`}>
          {done.failed.length > 0 && <ul className="mt-1 list-disc ps-5">{done.failed.map((f) => <li key={f.line}>Row {f.line}: {f.error}</li>)}</ul>}
          {(c!.invalid + c!.duplicate) > 0 && <p className="mt-1">{c!.invalid + c!.duplicate} row(s) were skipped because of errors — fix them in the file and import again.</p>}
        </Alert>
      )}
    </div>
  );
}
function Tile({ label, value, tone }: { label: string; value: number; tone?: 'ok' | 'bad' | 'warn' }) {
  return <div className="rounded-[14px] border border-line bg-surface p-4"><p className="text-[13px] text-muted">{label}</p><p className={`text-2xl font-semibold tabular ${tone === 'ok' ? 'text-ok' : tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : ''}`}>{value}</p></div>;
}
