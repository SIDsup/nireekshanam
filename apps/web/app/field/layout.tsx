import type { Metadata } from 'next';
import { FieldShell } from '@/components/field/shell';
import { resolveFieldAssistant } from '@/lib/field/bundle';
import { viewer } from '@/lib/session';

export const metadata: Metadata = { title: { default: 'Field', template: '%s · Field' } };

/** Mobile shell for Field Assistants: offline-first, bottom tab bar (SPECS §4.1). */
export default async function FieldLayout({ children }: { children: React.ReactNode }) {
  const user = await viewer();
  const { fa, demo } = resolveFieldAssistant(user.role === 'FIELD_ASSISTANT' ? user : null);
  return <FieldShell demoName={demo ? fa.name : null}>{children}</FieldShell>;
}
