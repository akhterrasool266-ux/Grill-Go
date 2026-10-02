'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { scanAttendance } from '@/app/actions/attendance';
import { Badge } from '@/components/ui/primitives';

interface Hit { id: number; code: string; ok: boolean; text: string; tone: 'ok' | 'warn' | 'bad' }

/** Gate scanner: camera + BarcodeDetector where the browser supports it (Chrome on Android), typed entry everywhere. */
export function Scanner() {
  const video = useRef<HTMLVideoElement>(null);
  const [hits, setHits] = useState<Hit[]>([]);
  const [camera, setCamera] = useState<'idle' | 'on' | 'unsupported' | 'denied'>('idle');
  const [manual, setManual] = useState('');
  const last = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const seq = useRef(0);

  const submit = useCallback(async (raw: string) => {
    const code = raw.trim().toUpperCase();
    if (!code) return;
    if (last.current.code === code && Date.now() - last.current.at < 4000) return;     // ignore the same card held in view
    last.current = { code, at: Date.now() };
    const r = await scanAttendance({ code });
    const id = ++seq.current;
    if (r.ok && r.data) {
      const d = r.data as { student: string; class: string; status: string; already_marked: boolean };
      setHits((h) => [{ id, code, ok: true, tone: (d.already_marked || d.status === 'late' ? 'warn' : 'ok') as Hit['tone'], text: `${d.student} · ${d.class ?? ''} — ${d.already_marked ? 'already marked ' : ''}${d.status}` }, ...h].slice(0, 12));
      navigator.vibrate?.(60);
    } else setHits((h) => [{ id, code, ok: false, tone: 'bad' as const, text: r.ok ? 'Unknown response' : r.error }, ...h].slice(0, 12));
  }, []);

  useEffect(() => {
    let stream: MediaStream | undefined, timer: ReturnType<typeof setInterval> | undefined, stopped = false;
    async function start() {
      const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
      if (!BD || !navigator.mediaDevices?.getUserMedia) { setCamera('unsupported'); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (stopped || !video.current) return;
        video.current.srcObject = stream; await video.current.play(); setCamera('on');
        const det = new BD({ formats: ['qr_code'] });
        timer = setInterval(async () => { try { const f = await det.detect(video.current!); if (f[0]) void submit(f[0].rawValue); } catch { /* frame not ready */ } }, 400);
      } catch { setCamera('denied'); }
    }
    void start();
    return () => { stopped = true; if (timer) clearInterval(timer); stream?.getTracks().forEach((t) => t.stop()); };
  }, [submit]);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[14px] border border-line bg-black">
        <video ref={video} playsInline muted className={camera === 'on' ? 'aspect-[4/3] w-full object-cover' : 'hidden'} />
        {camera !== 'on' && <p className="p-6 text-center text-sm text-white/80">{camera === 'unsupported' ? 'This browser cannot scan QR codes from the camera. Type or scan the ID with a USB/Bluetooth scanner below.' : camera === 'denied' ? 'Camera permission was denied. Allow camera access in the browser settings, or type the ID below.' : 'Starting camera…'}</p>}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void submit(manual); setManual(''); }} className="flex gap-2">
        <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Student ID e.g. STD-0012" autoCapitalize="characters" autoComplete="off" className="input uppercase" aria-label="Student ID" />
        <button className="rounded-[10px] bg-brand px-5 text-sm font-medium text-brand-fg">Mark</button>
      </form>
      <ul className="space-y-2" aria-live="polite">{hits.map((h) => <li key={h.id} className="flex items-center justify-between gap-3 rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-sm"><span>{h.text}</span><Badge tone={h.tone}>{h.code}</Badge></li>)}</ul>
    </div>
  );
}
