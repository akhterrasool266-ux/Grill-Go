import Link from 'next/link';
import { Alert, PageHeader } from '@/components/ui/primitives';

export default async function PayResult({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  return (<><PageHeader title="Online payment" />{s === 'ok' ? <Alert tone="ok" title="Payment received">Thank you. Your receipt is in the Fees tab and a confirmation message is on its way.</Alert> : s === 'declined' ? <Alert tone="warn" title="Payment was not completed">Nothing was charged to the school account. You can try again.</Alert> : <Alert tone="bad" title="We could not confirm this payment">If money was deducted, do not pay again — contact the school office with your JazzCash receipt.</Alert>}<p className="mt-4"><Link href="/portal/parent" className="text-brand hover:underline">Back to my children</Link></p></>);
}
