'use client';
import { saveCms } from '@/app/actions/settings';
import { ActionForm, Checkbox, Field, Input, SubmitButton, Textarea } from '@/components/ui/action-form';

const F = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <ActionForm action={saveCms} className="grid gap-4 sm:grid-cols-2"><input type="hidden" name="__key" value={k} />{children}<div className="sm:col-span-2"><SubmitButton pendingText="Saving…">Save</SubmitButton></div></ActionForm>
);
const T = ({ name, label, v, wide, area }: { name: string; label: string; v?: string; wide?: boolean; area?: boolean }) => (
  <Field label={label} name={name} className={wide || area ? 'sm:col-span-2' : undefined}>{area ? <Textarea name={name} rows={4} defaultValue={v ?? ''} /> : <Input name={name} defaultValue={v ?? ''} />}</Field>
);

export function CmsForm({ k, v }: { k: string; v: Record<string, any> }) {
  switch (k) {
    case 'hero': return <F k={k}><T name="title" label="Headline" v={v.title} wide /><T name="subtitle" label="Sub-headline" v={v.subtitle} wide /></F>;
    case 'about': return <F k={k}><T name="text" label="About the school" v={v.text} area /></F>;
    case 'principal_message': return <F k={k}><T name="name" label="Principal's name" v={v.name} /><T name="text" label="Message" v={v.text} area /></F>;
    case 'contact': return <F k={k}><T name="address" label="Address" v={v.address} wide /><T name="phone" label="Phone" v={v.phone} /><T name="email" label="Email" v={v.email} /><T name="hours" label="Office hours" v={v.hours} wide /></F>;
    case 'admissions': return <F k={k}><div className="sm:col-span-2"><Checkbox name="open" label="Accept online applications" defaultChecked={v.open !== false} /></div><T name="note" label="Note shown on the website (fee info, dates, documents needed)" v={v.note} area /></F>;
    case 'social': return <F k={k}><T name="facebook" label="Facebook link" v={v.facebook} wide /><T name="instagram" label="Instagram link" v={v.instagram} wide /><T name="youtube" label="YouTube link" v={v.youtube} wide /></F>;
    default: return null;
  }
}
