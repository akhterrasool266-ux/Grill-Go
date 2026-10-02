import { QrSvg } from '@/components/ui/qr';
import { initials } from '@/lib/format';

export interface IdCardProps {
  schoolName: string; schoolLine?: string; logoUrl?: string | null;
  name: string; code: string; line1: string; line2?: string; photoUrl?: string | null; kind: 'STUDENT' | 'STAFF'; phone?: string | null; bloodGroup?: string | null;
}

/** CR80 (85.6 × 54 mm) card. Printed from the browser; the QR holds only the ID (used by gate scanning). */
export async function IdCard(p: IdCardProps) {
  return (
    <div className="print-sheet relative flex h-[54mm] w-[85.6mm] break-inside-avoid overflow-hidden rounded-[3mm] border border-neutral-300 bg-white text-[#111]" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
      <div className="absolute inset-x-0 top-0 flex h-[11mm] items-center gap-2 px-[3mm] text-white" style={{ background: '#0b6b5f' }}>
        <span className="grid size-[7mm] place-items-center rounded-full bg-white text-[8px] font-bold text-[#0b6b5f]">{p.logoUrl ? '' : initials(p.schoolName)}</span>
        <div className="min-w-0 leading-tight"><p className="truncate text-[9px] font-bold">{p.schoolName}</p>{p.schoolLine && <p className="truncate text-[6.5px] opacity-90">{p.schoolLine}</p>}</div>
        <span className="ms-auto text-[6.5px] font-semibold tracking-widest opacity-90">{p.kind}</span>
      </div>
      <div className="mt-[11mm] flex w-full gap-[3mm] p-[3mm]">
        <div className="grid h-[24mm] w-[19mm] shrink-0 place-items-center overflow-hidden rounded-[1.5mm] border border-neutral-300 bg-neutral-100 text-lg font-bold text-neutral-400">
          {p.photoUrl /* eslint-disable-next-line @next/next/no-img-element */ ? <img src={p.photoUrl} alt="" className="h-full w-full object-cover" /> : initials(p.name)}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div className="leading-tight"><p className="text-[10px] font-bold">{p.name}</p><p className="text-[7.5px] text-neutral-600">{p.line1}</p>{p.line2 && <p className="text-[7.5px] text-neutral-600">{p.line2}</p>}</div>
          <div className="flex items-end justify-between gap-1">
            <div className="text-[7px] leading-snug"><p><b>ID:</b> {p.code}</p>{p.bloodGroup && <p><b>Blood:</b> {p.bloodGroup}</p>}{p.phone && <p><b>Contact:</b> {p.phone}</p>}</div>
            <QrSvg value={p.code} size={52} />
          </div>
        </div>
      </div>
    </div>
  );
}
