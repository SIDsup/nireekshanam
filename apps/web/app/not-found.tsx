import Link from 'next/link';
import { BrandMark } from '@/components/ui/icon';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <BrandMark size={44} />
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Not found</h1>
        <p className="text-[15px] leading-relaxed text-muted">That page or lot does not exist. Lot IDs are 21 characters, for example 0126HP2041015TS004201.</p>
        <Link href="/" className="flex h-11 items-center rounded-xl bg-brand px-5 text-sm font-medium text-white">Back to overview</Link>
      </div>
    </main>
  );
}
