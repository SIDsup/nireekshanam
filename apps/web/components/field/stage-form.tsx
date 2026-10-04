'use client';

import {
  checkDateOrder,
  checkFence,
  estimateSeedKg,
  GPS_ACCURACY_WARNING_M,
  missingPredecessors,
  SQM_PER_ACRE,
  stageRecordSchema,
  type FormField,
  type StageCode,
  type StageDefinition,
} from '@nk/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icon';
import { cx } from '@/components/ui/primitives';
import { fmtDay } from '@/lib/format';
import { deviceId } from '@/lib/field/db';
import { processPhoto } from '@/lib/field/photo';
import { lotProgress, lotRecords, nextRound, projectFence, shortLotId, stageLabel } from '@/lib/field/progress';
import { saveToOutbox } from '@/lib/field/sync';
import type { BundleLot, FieldBundle, OutboxItem } from '@/lib/field/types';
import { showToast, useFieldData, useRouteParams } from '@/lib/field/use-field';
import { BundleGate, SubHeader } from './ui';

export const APP_VERSION = 'web-0.1.0';

/* ---------- route wrapper ---------- */

export function StageFormScreen() {
  const params = useRouteParams(['lotId', 'stageCode'] as const);
  const { row, outbox } = useFieldData();

  if (!params || row === undefined) return <><SubHeader title="Stage entry" /><BundleGate state="loading" /></>;
  if (row === null) return <><SubHeader title="Stage entry" /><BundleGate state="missing" /></>;
  const bundle = row.data;
  const lot = bundle.lots.find((l) => l.lotId === params.lotId);
  const def = lot ? bundle.stages[lot.cropCode]?.find((d) => d.stageCode === params.stageCode) : undefined;
  if (!lot || !def) {
    return (
      <>
        <SubHeader title="Stage entry" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-signal-tint text-signal-text"><Icon name="alert" size={22} /></span>
          <h2 className="text-lg font-semibold">{lot ? 'This stage does not apply to this crop' : 'This lot is not in your list'}</h2>
          <p className="font-mono text-[13px] text-muted">{params.lotId}</p>
          <Link href="/field/lots" className="mt-2 flex h-[50px] items-center rounded-[14px] bg-brand px-6 text-[15px] font-semibold text-white">Open my lots</Link>
        </div>
      </>
    );
  }
  return <StageForm key={`${lot.lotId}:${def.stageCode}`} bundle={bundle} lot={lot} def={def} outbox={outbox} />;
}

/* ---------- GPS ---------- */

interface Fix {
  lat: number;
  lng: number;
  accuracy: number;
  at: number;
  source: 'gps' | 'demo';
}

type GpsStatus = 'waiting' | 'ok' | 'denied' | 'unavailable';

function useGps(): { fix: Fix | null; status: GpsStatus; message: string | null } {
  const [fix, setFix] = useState<Fix | null>(null);
  const [status, setStatus] = useState<GpsStatus>('waiting');
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!window.isSecureContext || !('geolocation' in navigator)) {
      setStatus('unavailable');
      setMessage(!window.isSecureContext ? 'GPS needs a secure (https) connection.' : 'This browser has no GPS access.');
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setFix({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: p.timestamp, source: 'gps' });
        setStatus('ok');
        setMessage(null);
      },
      (e) => {
        if (e.code === e.PERMISSION_DENIED) { setStatus('denied'); setMessage('Location permission is off. Allow location for this site in browser settings.'); }
        else { setStatus((s) => (s === 'ok' ? s : 'unavailable')); setMessage(e.code === e.TIMEOUT ? 'Still waiting for a GPS fix. Move to open sky.' : 'GPS is not available right now.'); }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);
  return { fix, status, message };
}

/* ---------- helpers ---------- */

type Value = string | string[];
interface Photo { id: string; blob: Blob; url: string; width: number; height: number }

const DECIMAL_UNITS = new Set(['g', 'kg', 'm²', '%', 'cm']);
const OBSERVED_FIELD: FormField = { key: 'observed_on', label: 'Observation date', type: 'date', required: true };
const OUT_REASONS = ['Recorded from the bund', 'Access path blocked', 'GPS slow under canopy', 'Saved after leaving the field'];
const END_DATES: Record<string, string> = { end_date: 'start_date', detasseling_end: 'detasseling_start' };

function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const toNum = (v: Value | undefined): number | null => {
  if (typeof v !== 'string' || v.trim() === '') return null;
  const n = Number(v.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

/* ---------- form ---------- */

function StageForm({ bundle, lot, def, outbox }: { bundle: FieldBundle; lot: BundleLot; def: StageDefinition; outbox: OutboxItem[] }) {
  const router = useRouter();
  const [recordUuid] = useState(uuid);
  const records = useMemo(() => lotRecords(lot, outbox), [lot, outbox]);
  const definitions = bundle.stages[lot.cropCode] ?? [];
  const progress = useMemo(() => lotProgress(bundle, lot, outbox).find((p) => p.definition.stageCode === def.stageCode), [bundle, lot, outbox, def.stageCode]);

  // Captured once so the round number does not jump when this record itself enters the outbox.
  const [ctx] = useState(() => {
    const prior = records.filter((r) => r.stageCode === def.stageCode).sort((a, b) => a.observedOn.localeCompare(b.observedOn));
    const supersedes = !def.repeatable && prior.length ? prior[prior.length - 1]! : null;
    return { roundNo: supersedes ? supersedes.roundNo : nextRound(def, records), supersedes };
  });

  const fields = useMemo<FormField[]>(() => {
    const own = def.fields.filter((f) => !f.transplantedOnly || lot.isTransplanted);
    return own.some((f) => f.type === 'date') ? own : [OBSERVED_FIELD, ...own];
  }, [def, lot.isTransplanted]);
  const observedKey = fields.find((f) => f.type === 'date')!.key;
  const photoField = fields.find((f) => f.type === 'photo');
  const minPhotos = Math.max(def.minPhotos, photoField?.required ? 1 : 0);

  const [values, setValues] = useState<Record<string, Value>>(() => {
    const init: Record<string, Value> = {};
    for (const f of fields) init[f.key] = f.type === 'multichoice' ? [] : f.key === observedKey ? bundle.today : '';
    return init;
  });
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState('');
  const [reason, setReason] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [processing, setProcessing] = useState(0);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const gps = useGps();
  const [demoFix, setDemoFix] = useState<Fix | null>(null);
  const fix = demoFix ?? gps.fix;
  const fence = fix ? checkFence({ lng: fix.lng, lat: fix.lat }, lot.geofence, fix.accuracy) : null;

  // Revoke thumbnail URLs when the form goes away.
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  /* computed fields */
  const computed = useMemo(() => {
    const out: Record<string, { value: number | string | null; note: string }> = {};
    for (const f of fields) {
      if (f.type !== 'computed') continue;
      if (f.key === 'ratio_f_m') {
        const female = toNum(values.seedlings_planted);
        const male = lot.facts.malePlants;
        out[f.key] = female && male ? { value: `${(female / male).toFixed(1)} : 1`, note: `${female} female ÷ ${male} male seedlings` } : { value: lot.ratio.replace(':', ' : '), note: 'Planned ratio for this hybrid' };
      } else if (f.key === 'estimated_seed_kg') {
        const fromTp = lot.facts.femalePlants;
        const plants = fromTp ?? Math.round((lot.contractedAreaSqm / SQM_PER_ACRE) * 2900);
        const fpp = toNum(values.fruits_per_plant);
        const gpf = toNum(values.seed_g_per_fruit);
        out[f.key] = fpp !== null && gpf !== null
          ? { value: estimateSeedKg({ femalePlants: plants, fruitsPerPlant: fpp, seedGramsPerFruit: gpf }), note: `${plants.toLocaleString('en-IN')} female plants ${fromTp ? 'from transplanting' : 'estimated from contracted area'}` }
          : { value: null, note: 'Enter fruits per plant and seed per fruit' };
      } else if (f.key === 'picking_no') {
        out[f.key] = { value: ctx.roundNo, note: 'Counted on this phone' };
      } else if (f.key === 'variance_vs_estimate' || f.key === 'variance_vs_target') {
        const final = toNum(values.final_seed_kg);
        const ref = f.key === 'variance_vs_estimate' ? lot.facts.estimateKg : lot.targetYieldKg;
        out[f.key] = final !== null && ref ? { value: Math.round(((final - ref) / ref) * 1000) / 10, note: `Against ${ref.toLocaleString('en-IN')} kg ${f.key === 'variance_vs_estimate' ? 'estimate' : 'target'}` } : { value: null, note: ref ? 'Enter the final seed weight' : 'No estimate recorded' };
      } else {
        out[f.key] = { value: null, note: '' };
      }
    }
    return out;
  }, [fields, values, lot, ctx.roundNo]);

  /* validation */
  const observedOn = typeof values[observedKey] === 'string' ? (values[observedKey] as string) : '';
  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    for (const f of fields) {
      const v = values[f.key];
      if (f.type === 'photo' || f.type === 'computed') continue;
      const empty = v === undefined || (Array.isArray(v) ? v.length === 0 : v.trim() === '');
      if (f.required && empty) { e[f.key] = f.type === 'choice' || f.type === 'multichoice' ? 'Choose one' : 'Required'; continue; }
      if (empty) continue;
      if (f.type === 'number') {
        const n = toNum(v);
        if (n === null) e[f.key] = 'Enter a number';
        else if (n < 0) e[f.key] = 'Cannot be negative';
        else if (f.unit === '%' && n > 100) e[f.key] = 'Cannot be more than 100%';
      }
      if (f.type === 'date' && typeof v === 'string') {
        if (v > bundle.today) e[f.key] = 'Date cannot be in the future';
        const startKey = END_DATES[f.key];
        const start = startKey ? values[startKey] : undefined;
        if (typeof start === 'string' && start && v < start) e[f.key] = 'Cannot be before the start date';
      }
    }
    if (observedOn && !e[observedKey]) {
      const prior = records.filter((r) => r.recordUuid !== ctx.supersedes?.recordUuid);
      const issue = checkDateOrder(definitions, prior, { stageCode: def.stageCode, observedOn });
      if (issue) {
        const name = definitions.find((d) => d.stageCode === issue.laterThan.stageCode)?.name ?? issue.laterThan.stageCode;
        e[observedKey] = `Must be on or after ${name} (${fmtDay(issue.laterThan.observedOn)})`;
      }
    }
    const est = overrides.estimated_seed_kg;
    if (est !== undefined && est !== '' && (toNum(est) === null || toNum(est)! < 0)) e.estimated_seed_kg = 'Enter a number';
    return e;
  }, [fields, values, bundle.today, observedOn, observedKey, records, ctx.supersedes, definitions, def.stageCode, overrides]);

  const missing = useMemo(() => missingPredecessors(definitions, records.map((r) => r.stageCode as StageCode), def.stageCode), [definitions, records, def.stageCode]);
  const needsReason = !!fence && !fence.inside;
  const blockers: string[] = [];
  if (Object.keys(errors).length) blockers.push('Fix the highlighted fields');
  if (!fix) blockers.push('Waiting for a GPS fix');
  if (needsReason && !reason.trim()) blockers.push('Give a reason for saving outside the geo-fence');
  if (photos.length < minPhotos) blockers.push(`Add at least ${minPhotos} photo${minPhotos === 1 ? '' : 's'}`);
  if (processing > 0) blockers.push('Wait for photos to finish');

  const set = (key: string, v: Value) => setValues((s) => ({ ...s, [key]: v }));

  async function addPhoto(file: File) {
    setPhotoError(null);
    setProcessing((n) => n + 1);
    try {
      const p = await processPhoto(file, { lotId: lot.lotId, capturedAt: new Date(), lat: fix?.lat ?? null, lng: fix?.lng ?? null, accuracyM: fix?.accuracy ?? null });
      const url = URL.createObjectURL(p.blob);
      urls.current.push(url);
      setPhotos((ps) => [...ps, { id: uuid(), blob: p.blob, url, width: p.width, height: p.height }]);
    } catch {
      setPhotoError('Could not read that photo. Try taking it again.');
    } finally {
      setProcessing((n) => n - 1);
    }
  }

  function removePhoto(id: string) {
    setPhotos((ps) => {
      const p = ps.find((x) => x.id === id);
      if (p) URL.revokeObjectURL(p.url);
      return ps.filter((x) => x.id !== id);
    });
  }

  async function save() {
    setAttempted(true);
    setSaveError(null);
    if (blockers.length || !fix || saving) return;
    setSaving(true);
    try {
      const data: Record<string, unknown> = {};
      for (const f of fields) {
        if (f.type === 'photo' || f.key === OBSERVED_FIELD.key) continue;
        if (f.type === 'computed') {
          const o = overrides[f.key];
          const v = o !== undefined && o !== '' ? toNum(o) : computed[f.key]?.value;
          if (v !== null && v !== undefined) data[f.key] = v;
          continue;
        }
        const v = values[f.key];
        if (v === undefined || (Array.isArray(v) ? v.length === 0 : v.trim() === '')) continue;
        data[f.key] = f.type === 'number' ? toNum(v) : typeof v === 'string' ? v.trim() : v;
      }
      if (fix.source === 'demo') data.gps_source = 'demo-farm-centre';

      const parsed = stageRecordSchema.safeParse({
        recordUuid,
        lotId: lot.lotId,
        stageCode: def.stageCode,
        roundNo: ctx.roundNo,
        observedOn,
        capturedAt: new Date().toISOString(),
        gps: { lng: fix.lng, lat: fix.lat },
        gpsAccuracyM: Math.round(fix.accuracy * 10) / 10,
        insideGeofence: !!fence?.inside,
        mockLocationDetected: false,
        outOfFenceReason: fence?.inside ? undefined : reason.trim(),
        capturedBy: bundle.fa.id,
        deviceId: await deviceId(),
        appVersion: APP_VERSION,
        data,
        remarks: remarks.trim() || undefined,
        photoIds: photos.map((p) => p.id),
        supersedes: ctx.supersedes?.recordUuid ?? null,
      });
      if (!parsed.success) {
        setSaveError(parsed.error.issues[0]?.message ?? 'The record is not valid');
        return;
      }
      // IndexedDB first: the record is safe on the phone before any network attempt.
      await saveToOutbox({
        recordUuid,
        record: parsed.data,
        status: 'pending',
        createdAt: Date.now(),
        attempts: 0,
        stageName: stageLabel(def, ctx.roundNo),
        farmerName: lot.farmer.name,
        photoCount: photos.length,
        photoBytes: photos.reduce((a, p) => a + p.blob.size, 0),
      }, photos);
      showToast(navigator.onLine ? `${stageLabel(def, ctx.roundNo)} saved. Sending now.` : `${stageLabel(def, ctx.roundNo)} saved on this phone. It will sync when you are online.`);
      router.push('/field');
    } catch (err) {
      setSaveError(err instanceof Error ? `Could not save: ${err.message}` : 'Could not save on this phone');
    } finally {
      setSaving(false);
    }
  }

  const title = stageLabel(def, ctx.roundNo);
  const dueText = progress && progress.status === 'OVERDUE' ? `Due ${fmtDay(progress.dueOn)} · ${progress.daysLate} ${progress.daysLate === 1 ? 'day' : 'days'} late` : progress && (progress.status === 'DUE' || progress.status === 'UPCOMING') ? `Due ${fmtDay(progress.dueOn)}` : null;

  return (
    <>
      <SubHeader
        title={title}
        back={`/field/lots/${lot.lotId}`}
        subtitle={<>{lot.farmer.name} · {lot.village.name} · <span className="font-mono">{shortLotId(lot.lotId)}</span></>}
      />

      <form
        className="flex flex-1 flex-col"
        noValidate
        onSubmit={(e) => { e.preventDefault(); void save(); }}
      >
        <div className="flex flex-1 flex-col gap-3.5 p-3.5">
          {(dueText || ctx.supersedes) && (
            <div className="flex flex-wrap gap-2 text-[12.5px]">
              {dueText && <span className={cx('rounded-full px-2.5 py-1 font-medium', progress?.status === 'OVERDUE' ? 'bg-signal-tint text-signal-text' : 'bg-ground-2 text-subtle')}>{dueText}</span>}
              <span className="rounded-full bg-ground-2 px-2.5 py-1 text-subtle">{lot.cropName} {lot.hybridCode}</span>
            </div>
          )}

          {ctx.supersedes && (
            <Notice tone="sky" icon="info">
              Already recorded on {fmtDay(ctx.supersedes.observedOn)}. Saving creates a correction that replaces it.
            </Notice>
          )}

          {missing.length > 0 && (
            <Notice tone="signal" icon="alert">
              Not yet recorded: {missing.slice(0, 3).map((m) => m.name).join(', ')}{missing.length > 3 ? ` and ${missing.length - 3} more` : ''}. You can still save this stage.
            </Notice>
          )}

          <LocationCard lot={lot} fix={fix} fence={fence} gps={gps} demo={bundle.demo} demoActive={!!demoFix} onDemo={() => setDemoFix({ lat: lot.farmCentre.lat, lng: lot.farmCentre.lng, accuracy: 5, at: Date.now(), source: 'demo' })} onLive={() => setDemoFix(null)} />

          {needsReason && (
            <fieldset className="flex flex-col gap-2 rounded-2xl border border-[#f3d7ae] bg-signal-tint/50 p-3.5">
              <legend className="sr-only">Reason for saving outside the fence</legend>
              <label htmlFor="out-reason" className="text-[13px] font-medium text-signal-text">
                Why are you outside the fence? <span className="text-signal">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {OUT_REASONS.map((r) => (
                  <ChoicePill key={r} selected={reason === r} onClick={() => setReason(reason === r ? '' : r)}>{r}</ChoicePill>
                ))}
              </div>
              <textarea
                id="out-reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Or type the reason"
                className={cx('rounded-xl border bg-surface px-3.5 py-3 text-[15px] outline-none focus:border-brand', attempted && !reason.trim() ? 'border-signal' : 'border-line-strong')}
              />
              <p className="text-[12px] text-signal-text">The record is saved and flagged for your supervisor to review.</p>
            </fieldset>
          )}

          {fields.map((f) => {
            if (f.type === 'photo') {
              return <PhotoField key={f.key} label={f.label} min={minPhotos} photos={photos} processing={processing} error={photoError ?? (attempted && photos.length < minPhotos ? `Add at least ${minPhotos}` : null)} onAdd={addPhoto} onRemove={removePhoto} />;
            }
            return (
              <Field
                key={f.key}
                field={f}
                value={values[f.key]}
                error={attempted || (f.type === 'date' && f.key === observedKey) ? errors[f.key] : undefined}
                max={bundle.today}
                computed={computed[f.key]}
                override={overrides[f.key]}
                onOverride={(v) => setOverrides((o) => ({ ...o, [f.key]: v }))}
                onChange={(v) => set(f.key, v)}
              />
            );
          })}

          {!photoField && minPhotos > 0 && (
            <PhotoField label="Photos" min={minPhotos} photos={photos} processing={processing} error={photoError ?? (attempted && photos.length < minPhotos ? `Add at least ${minPhotos}` : null)} onAdd={addPhoto} onRemove={removePhoto} />
          )}

          <div className="flex flex-col gap-[7px]">
            <label htmlFor="remarks" className="text-[13px] font-medium">Remarks</label>
            <textarea id="remarks" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" className="resize-none rounded-xl border border-line-strong bg-surface px-3.5 py-3 text-[15px] outline-none focus:border-brand" />
          </div>
        </div>

        <div className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-line bg-surface px-3.5 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
          {attempted && blockers.length > 0 && (
            <p role="alert" className="text-center text-[13px] font-medium text-signal-text">{blockers[0]}</p>
          )}
          {saveError && <p role="alert" className="text-center text-[13px] font-medium text-signal-text">{saveError}</p>}
          <button type="submit" disabled={saving} className="flex h-[52px] items-center justify-center gap-2 rounded-[14px] bg-brand text-[16px] font-semibold text-white active:bg-brand-strong disabled:opacity-60">
            {saving ? 'Saving…' : ctx.supersedes ? 'Save correction' : 'Save record'}
          </button>
          <p className="text-center text-[11.5px] text-muted">Saved on this phone. Syncs when you are back online.</p>
        </div>
      </form>
    </>
  );
}

/* ---------- pieces ---------- */

function Notice({ tone, icon, children }: { tone: 'signal' | 'sky'; icon: 'alert' | 'info'; children: React.ReactNode }) {
  return (
    <div className={cx('flex gap-2.5 rounded-2xl px-3.5 py-3 text-[13px] leading-snug', tone === 'signal' ? 'bg-signal-tint text-signal-text' : 'bg-sky-tint text-sky-text')}>
      <Icon name={icon} size={17} strokeWidth={2} className="mt-px flex-none" />
      <p>{children}</p>
    </div>
  );
}

function LocationCard({ lot, fix, fence, gps, demo, demoActive, onDemo, onLive }: {
  lot: BundleLot;
  fix: Fix | null;
  fence: ReturnType<typeof checkFence> | null;
  gps: ReturnType<typeof useGps>;
  demo: boolean;
  demoActive: boolean;
  onDemo: () => void;
  onLive: () => void;
}) {
  const W = 360, H = 120;
  const proj = projectFence(lot.geofence, fix ? { lng: fix.lng, lat: fix.lat } : null, W, H);
  const weak = !!fix && fix.accuracy > GPS_ACCURACY_WARNING_M;
  const accR = fix ? Math.min(48, Math.max(10, fix.accuracy * proj.metresToPx)) : 0;

  let title = 'Waiting for GPS…';
  let sub = gps.message ?? 'Hold the phone up with a clear view of the sky.';
  let tone: 'ok' | 'warn' | 'wait' = 'wait';
  if (fix && fence) {
    sub = `${fix.lat.toFixed(4)}, ${fix.lng.toFixed(4)} · ±${Math.round(fix.accuracy)} m`;
    if (fence.inside) { title = 'Inside geo-fence'; tone = 'ok'; }
    else if (fence.acceptable) { title = `Just outside the fence (${Math.round(fence.distanceOutsideM)} m)`; tone = 'warn'; }
    else { title = `Outside geo-fence by ${fence.distanceOutsideM < 1000 ? `${Math.round(fence.distanceOutsideM)} m` : `${(fence.distanceOutsideM / 1000).toFixed(1)} km`}`; tone = 'warn'; }
  }

  return (
    <section aria-label="Location check" className={cx('overflow-hidden rounded-2xl border bg-surface', tone === 'warn' ? 'border-[#f3d7ae]' : 'border-[#d6e4f1]')}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" aria-hidden="true" className="block bg-[#eef1ea]">
        <polygon points={proj.points} fill="#7fbf93" fillOpacity={0.35} stroke="#2f7d4e" strokeWidth={2} strokeLinejoin="round" />
        {proj.position && (
          <>
            <circle cx={proj.position.x} cy={proj.position.y} r={accR} fill={tone === 'warn' ? '#d98a2b' : '#1f6fb2'} fillOpacity={0.15} />
            <circle cx={proj.position.x} cy={proj.position.y} r={7} fill={tone === 'warn' ? '#b4570f' : '#1f6fb2'} stroke="#ffffff" strokeWidth={2.5} />
          </>
        )}
        {proj.position?.offscreen && (
          <text x={W - 8} y={H - 8} textAnchor="end" fontSize="11" fill="#7a3f08">You are off the map</text>
        )}
      </svg>
      <div className="flex items-center gap-2.5 px-3.5 py-3">
        <span className={cx('flex size-[30px] flex-none items-center justify-center rounded-full', tone === 'ok' ? 'bg-sky-tint text-sky-text' : tone === 'warn' ? 'bg-signal-tint text-signal-text' : 'bg-ground-2 text-muted')}>
          <Icon name={tone === 'ok' ? 'check' : tone === 'warn' ? 'alert' : 'locate'} size={16} strokeWidth={2.4} className={tone === 'wait' ? 'animate-pulse' : undefined} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold">{title}</div>
          <div className={cx('text-[12px] text-muted', fix && 'font-mono')}>{sub}</div>
        </div>
        {fix && (
          <span className={cx('rounded-full px-[9px] py-[3px] text-[11.5px] font-medium whitespace-nowrap', fix.source === 'demo' ? 'bg-sky-tint text-sky-text' : weak ? 'bg-signal-tint text-signal-text' : 'bg-brand-tint text-brand-text')}>
            {fix.source === 'demo' ? 'Demo position' : weak ? 'Weak GPS' : 'GPS locked'}
          </span>
        )}
      </div>
      {weak && fix?.source === 'gps' && (
        <p className="border-t border-line-soft px-3.5 py-2.5 text-[12.5px] text-signal-text">
          GPS accuracy is ±{Math.round(fix.accuracy)} m (warning above {GPS_ACCURACY_WARNING_M} m). Step into the open and wait a few seconds for a better fix.
        </p>
      )}
      {demo && (
        <div className="flex items-center justify-between gap-3 border-t border-line-soft px-3.5 py-2">
          <span className="text-[12px] text-muted">{demoActive ? 'Using the farm centre instead of GPS.' : 'No GPS on this computer?'}</span>
          <button type="button" onClick={demoActive ? onLive : onDemo} className="flex min-h-11 items-center gap-1.5 text-[13px] font-medium text-sky-text">
            <Icon name="pin" size={15} strokeWidth={2} />
            {demoActive ? 'Use live GPS' : 'Use farm centre (demo)'}
          </button>
        </div>
      )}
    </section>
  );
}

function ChoicePill({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx('min-h-11 rounded-full border px-4 text-[14px]', selected ? 'border-brand bg-brand font-medium text-white' : 'border-line-strong bg-surface text-ink')}
    >
      {children}
    </button>
  );
}

const inputBase = 'h-[50px] w-full min-w-0 rounded-xl border bg-surface px-3.5 text-[16px] outline-none focus:border-brand';

function Field({ field: f, value, error, max, computed, override, onOverride, onChange }: {
  field: FormField;
  value: Value | undefined;
  error?: string;
  max: string;
  computed?: { value: number | string | null; note: string };
  override?: string;
  onOverride: (v: string) => void;
  onChange: (v: Value) => void;
}) {
  const id = `f-${f.key}`;
  const label = (
    <span className="text-[13px] font-medium">
      {f.label}
      {f.unit && f.type !== 'computed' && <span className="font-normal text-muted"> ({f.unit})</span>}
      {f.required && <span className="text-signal"> *</span>}
    </span>
  );
  const border = error ? 'border-signal' : 'border-line-strong';
  const errorText = error && <p className="text-[12.5px] font-medium text-signal-text">{error}</p>;

  if (f.type === 'choice' || f.type === 'multichoice') {
    const selected = Array.isArray(value) ? value : value ? [value] : [];
    const toggle = (o: string) => {
      if (f.type === 'choice') return onChange(selected[0] === o ? '' : o);
      if (o === 'None') return onChange(selected.includes('None') ? [] : ['None']);
      const rest = selected.filter((x) => x !== 'None');
      onChange(rest.includes(o) ? rest.filter((x) => x !== o) : [...rest, o]);
    };
    return (
      <fieldset className="flex flex-col gap-[7px]">
        <legend className="mb-[7px] p-0">{label}{f.type === 'multichoice' && <span className="text-[12px] text-muted"> · choose any</span>}</legend>
        <div className="flex flex-wrap gap-2">
          {(f.options ?? []).map((o) => <ChoicePill key={o} selected={selected.includes(o)} onClick={() => toggle(o)}>{o}</ChoicePill>)}
        </div>
        {errorText}
      </fieldset>
    );
  }

  if (f.type === 'computed') {
    const editable = f.key === 'estimated_seed_kg';
    const shown = computed?.value;
    return (
      <div className="flex flex-col gap-[7px]">
        <label htmlFor={id}>{label} <span className="text-[12px] font-normal text-muted">· calculated</span></label>
        {editable ? (
          <div className="flex items-center gap-2">
            <input
              id={id}
              inputMode="decimal"
              value={override ?? (shown === null || shown === undefined ? '' : String(shown))}
              onChange={(e) => onOverride(e.target.value)}
              placeholder="—"
              className={cx(inputBase, 'tabular font-semibold', border)}
            />
            {f.unit && <span className="w-8 text-[14px] text-muted">{f.unit}</span>}
          </div>
        ) : (
          <div id={id} className="tabular flex h-[50px] items-center rounded-xl border border-dashed border-line-strong bg-ground-3 px-3.5 text-[16px] font-semibold">
            {shown === null || shown === undefined ? <span className="font-normal text-faint">—</span> : <>{f.unit === '%' && typeof shown === 'number' && shown > 0 ? '+' : ''}{String(shown)}{f.unit ? ` ${f.unit}` : ''}</>}
          </div>
        )}
        {computed?.note && <p className="text-[12px] text-muted">{computed.note}{editable && override !== undefined && override !== String(shown ?? '') ? ' · edited' : ''}</p>}
        {errorText}
      </div>
    );
  }

  if (f.type === 'number' && !DECIMAL_UNITS.has(f.unit ?? '')) {
    const n = toNum(value);
    const step = (d: number) => onChange(String(Math.max(0, (n ?? 0) + d)));
    return (
      <div className="flex flex-col gap-[7px]">
        <label htmlFor={id}>{label}</label>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => step(-1)} aria-label={`Decrease ${f.label}`} className="flex size-[50px] flex-none items-center justify-center rounded-xl border border-line-strong bg-surface"><Icon name="minus" size={20} /></button>
          <input
            id={id}
            inputMode="numeric"
            pattern="[0-9]*"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))}
            className={cx(inputBase, 'tabular text-center text-[20px] font-semibold', error ? 'border-signal' : 'border-[1.5px] border-brand')}
          />
          <button type="button" onClick={() => step(1)} aria-label={`Increase ${f.label}`} className="flex size-[50px] flex-none items-center justify-center rounded-xl border border-line-strong bg-surface"><Icon name="plus" size={20} /></button>
        </div>
        {errorText}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[7px]">
      <label htmlFor={id}>{label}</label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type={f.type === 'date' ? 'date' : 'text'}
          inputMode={f.type === 'number' ? 'decimal' : undefined}
          max={f.type === 'date' ? max : undefined}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(f.type === 'number' ? e.target.value.replace(/[^\d.]/g, '') : e.target.value)}
          className={cx(inputBase, f.type === 'number' && 'tabular', border)}
        />
        {f.type === 'number' && f.unit && <span className="w-8 flex-none text-[14px] text-muted">{f.unit}</span>}
      </div>
      {errorText}
    </div>
  );
}

function PhotoField({ label, min, photos, processing, error, onAdd, onRemove }: {
  label: string;
  min: number;
  photos: Photo[];
  processing: number;
  error: string | null;
  onAdd: (f: File) => void;
  onRemove: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-[7px]">
      <span className="text-[13px] font-medium">
        {label} {min > 0 && <span className="text-signal">*</span>}{' '}
        <span className="font-normal text-muted">{min > 0 ? `min ${min} · ` : ''}camera only</span>
      </span>
      <div className="flex flex-wrap gap-2">
        {photos.map((p, i) => (
          <div key={p.id} className="relative size-[84px] overflow-hidden rounded-xl bg-forest-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={`Photo ${i + 1}`} className="size-full object-cover" />
            <button type="button" onClick={() => onRemove(p.id)} aria-label={`Remove photo ${i + 1}`} className="absolute top-0 right-0 flex size-11 items-start justify-end p-1">
              <span className="flex size-6 items-center justify-center rounded-full bg-forest/80 text-white"><Icon name="x" size={13} strokeWidth={2.4} /></span>
            </button>
          </div>
        ))}
        {Array.from({ length: processing }, (_, i) => (
          <div key={`p${i}`} className="flex size-[84px] animate-pulse items-center justify-center rounded-xl bg-line-soft text-[11px] text-muted">Processing…</div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cx('flex size-[84px] flex-col items-center justify-center gap-1 rounded-xl border-[1.5px] border-dashed bg-surface text-[11.5px] text-subtle', error ? 'border-signal' : 'border-[#9aa79f]')}
        >
          <Icon name="camera" size={22} />
          {photos.length ? 'Add' : 'Take photo'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) onAdd(file);
          }}
        />
      </div>
      {error && <p className="text-[12.5px] font-medium text-signal-text">{error}</p>}
      <p className="text-[12px] text-muted">Each photo is stamped with the lot ID, date, time and GPS.</p>
    </div>
  );
}
