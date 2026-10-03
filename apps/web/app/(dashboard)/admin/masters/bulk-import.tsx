'use client';

import { useId, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icon';
import { buttonClass, cx } from '@/components/ui/primitives';
import { parseCsv, toCsv } from '@/lib/csv';
import { dryRun, type DryRun, type ImportContext, type ImportEntity } from '@/lib/import-spec';

const MAX_BYTES = 5 * 1024 * 1024;
const SHOWN_ERRORS = 8;

interface Loaded {
  name: string;
  size: number;
  result: DryRun;
}

function fmtBytes(n: number) {
  return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Client-side CSV dry run: parse in the browser, validate every row with the shared Zod schemas. */
export function BulkImport({ entity, entityLabel, context }: { entity: ImportEntity; entityLabel: string; context: ImportContext }) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
      setLoaded(null);
      setError('Choose a .csv file. In Excel, use File › Save As › CSV UTF-8.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setLoaded(null);
      setError(`That file is ${fmtBytes(file.size)}. The limit is 5 MB per import.`);
      return;
    }
    setBusy(true);
    try {
      const table = parseCsv(await file.text());
      if (table.length < 2) {
        setLoaded(null);
        setError('The file has no data rows. Keep the header row and add one row per record.');
        return;
      }
      setLoaded({ name: file.name, size: file.size, result: dryRun(entity, table, context) });
    } catch {
      setLoaded(null);
      setError('The file could not be read. Check it is a plain-text CSV.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  function downloadErrors() {
    if (!loaded) return;
    const csv = toCsv(['row', 'field', 'message'], loaded.result.issues.map((i) => [i.row, i.field, i.message]));
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${loaded.name.replace(/\.csv$/i, '')}-errors.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const r = loaded?.result;
  const valid = r ? r.created + r.updated : 0;
  const step = r ? 2 : 1;

  return (
    <section aria-labelledby={`${inputId}-title`} className="flex min-w-0 flex-[1_1_340px] flex-col gap-4 rounded-[20px] border border-line bg-surface px-6 py-[22px]">
      <div>
        <h2 id={`${inputId}-title`} className="text-[17px] font-semibold tracking-[-0.01em]">Bulk import · {entityLabel}</h2>
        <p className="mt-1 text-[13px] text-muted">CSV with a header row. Nothing is saved until you commit.</p>
      </div>

      <ol className="flex gap-1.5 text-[12.5px]" aria-label="Import steps">
        {['Upload', 'Dry run', 'Commit'].map((s, i) => (
          <li key={s} className="flex flex-1 flex-col gap-1.5" aria-current={i + 1 === step ? 'step' : undefined}>
            <span className={cx('h-1 rounded-full', i < step ? 'bg-brand-mid' : 'bg-line-strong')} />
            <span className={i < step ? 'font-medium' : 'text-muted'}>{i + 1} · {s}</span>
          </li>
        ))}
      </ol>

      <input ref={input} id={inputId} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />

      {loaded ? (
        <div className="flex items-center gap-3 rounded-[14px] border border-line px-3.5 py-3">
          <span className="flex size-10 flex-none items-center justify-center rounded-[10px] bg-brand-tint text-brand-text"><Icon name="file" /></span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-medium">{loaded.name}</div>
            <div className="text-xs text-muted">{loaded.result.rows.toLocaleString('en-IN')} rows · {fmtBytes(loaded.size)}</div>
          </div>
          <label htmlFor={inputId} className="flex min-h-11 cursor-pointer items-center px-1 text-[13px] font-medium text-brand hover:text-brand-strong">Replace</label>
        </div>
      ) : (
        <label htmlFor={inputId} className="flex cursor-pointer flex-col items-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-line-strong bg-ground-3 px-4 py-7 text-center hover:border-brand-mid hover:bg-brand-soft">
          <span className="flex size-10 items-center justify-center rounded-[10px] bg-brand-tint text-brand-text"><Icon name="file" /></span>
          <span className="text-[13.5px] font-medium">{busy ? 'Reading file…' : 'Choose a CSV file'}</span>
          <span className="text-xs text-muted">Checked in your browser against the master rules</span>
        </label>
      )}

      {error && <p role="alert" className="rounded-xl bg-signal-tint px-3.5 py-2.5 text-[13px] text-signal-text">{error}</p>}

      {r && (
        <div aria-live="polite" className="flex flex-col gap-4">
          {r.missingColumns.length > 0 ? (
            <p role="alert" className="rounded-xl bg-signal-tint px-3.5 py-2.5 text-[13px] leading-normal text-signal-text">
              Missing {r.missingColumns.length === 1 ? 'column' : 'columns'}: <span className="font-mono">{r.missingColumns.join(', ')}</span>. Start from the template so the headers match.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 text-center">
              <Count value={r.created} label="New" className="bg-brand-soft" />
              <Count value={r.updated} label="Updated" className="bg-ground" />
              <Count value={r.invalid} label={r.invalid === 1 ? 'Row with errors' : 'Rows with errors'} className={r.invalid ? 'bg-signal-tint text-signal-text' : 'bg-ground'} />
            </div>
          )}

          {r.issues.length > 0 && (
            <div className="flex flex-col overflow-hidden rounded-[14px] border border-[#f3d7ae]">
              <ul>
                {r.issues.slice(0, SHOWN_ERRORS).map((e, i) => (
                  <li key={i} className="flex gap-2.5 border-b border-[#f8e8d0] bg-[#fffcf7] px-3 py-2.5 text-[12.5px] last:border-b-0">
                    <span className="w-[60px] flex-none font-mono font-semibold text-signal-text">Row {e.row}</span>
                    <span className="min-w-0 break-words"><b className="font-mono font-semibold">{e.field}</b> <span className="text-subtle">{e.message}</span></span>
                  </li>
                ))}
              </ul>
              {r.issues.length > SHOWN_ERRORS && <p className="bg-[#fffcf7] px-3 py-2 text-xs text-muted">and {(r.issues.length - SHOWN_ERRORS).toLocaleString('en-IN')} more in the error report</p>}
            </div>
          )}
          {r.issues.length === 0 && r.missingColumns.length === 0 && (
            <p className="flex items-center gap-2 rounded-xl bg-brand-tint px-3.5 py-2.5 text-[13px] text-brand-text"><Icon name="check" size={16} strokeWidth={2.2} />Every row passed validation.</p>
          )}

          <div className="flex flex-wrap gap-2.5">
            <button type="button" disabled aria-describedby={`${inputId}-commit-note`} className={cx(buttonClass('primary'), 'flex-1 font-semibold')}>
              Commit {valid.toLocaleString('en-IN')} valid {valid === 1 ? 'row' : 'rows'}
            </button>
            {r.issues.length > 0 && <button type="button" onClick={downloadErrors} className={buttonClass('secondary')}><Icon name="download" size={16} />Error report</button>}
          </div>
          <p id={`${inputId}-commit-note`} className="flex items-start gap-1.5 text-xs leading-normal text-muted">
            <Icon name="lock" size={14} className="mt-px flex-none" />
            Commit needs the database, which this demo build does not have. The dry run above is real: it uses the same rules the server will.
          </p>
        </div>
      )}
    </section>
  );
}

function Count({ value, label, className }: { value: number; label: string; className?: string }) {
  return (
    <div className={cx('rounded-xl p-2.5', className)}>
      <div className="tabular text-xl font-semibold">{value.toLocaleString('en-IN')}</div>
      <div className="text-[11.5px] opacity-90">{label}</div>
    </div>
  );
}
