'use client';

import { isValidLotId, parseLotId } from '@nk/shared';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icon';
import { cx } from '@/components/ui/primitives';
import { lotProgress, nextStage } from '@/lib/field/progress';
import { useFieldData } from '@/lib/field/use-field';
import { SubHeader } from './ui';

interface DetectedCode { rawValue: string }
interface BarcodeDetectorLike { detect: (source: CanvasImageSource) => Promise<DetectedCode[]> }
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => BarcodeDetectorLike;

/** Finds a lot ID in QR content: the bare ID, or a URL that contains it. */
function extractLotId(raw: string): string | null {
  const text = raw.trim().toUpperCase();
  if (isValidLotId(text)) return text;
  const m = text.match(/\d{4}[A-Z]{2}\d{7}[A-Z0-9]{6}\d{2}/g);
  return m?.find(isValidLotId) ?? null;
}

type CameraState = 'idle' | 'starting' | 'scanning' | 'unsupported' | 'denied' | 'error';

export function ScanScreen() {
  const router = useRouter();
  const { row, outbox } = useFieldData();
  const bundle = row?.data;
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camera, setCamera] = useState<CameraState>('idle');
  const [manual, setManual] = useState('');
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  /** Opens the lot's next due stage form, or the lot page when nothing is due. */
  const open = useCallback((lotId: string): boolean => {
    if (!bundle) { setError('Your lots are not on this phone yet. Sync first.'); return false; }
    const lot = bundle.lots.find((l) => l.lotId === lotId);
    if (!lot) { setError(`Lot ${lotId} is not assigned to you.`); return false; }
    stop();
    const next = lot.status === 'CLOSED' ? undefined : nextStage(lotProgress(bundle, lot, outbox));
    router.push(next && (next.status === 'OVERDUE' || next.status === 'DUE') ? `/field/lots/${lot.lotId}/stage/${next.definition.stageCode}` : `/field/lots/${lot.lotId}`);
    return true;
  }, [bundle, outbox, router, stop]);

  // Known only after mount, so the server HTML and the first client render agree.
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => setSupported('BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia), []);

  const start = useCallback(async () => {
    setError(null);
    if (!supported) { setCamera('unsupported'); return; }
    setCamera('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) { stop(); return; }
      video.srcObject = stream;
      await video.play();
      setCamera('scanning');
    } catch (e) {
      setCamera(e instanceof DOMException && e.name === 'NotAllowedError' ? 'denied' : 'error');
    }
  }, [supported, stop]);

  // Detection loop, about four frames a second to stay light on low-end phones.
  useEffect(() => {
    if (camera !== 'scanning') return;
    const Detector = (window as unknown as { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector;
    const detector = new Detector({ formats: ['qr_code'] });
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const video = videoRef.current;
      if (cancelled || !video) return;
      try {
        if (video.readyState >= 2) {
          const codes = await detector.detect(video);
          for (const c of codes) {
            const id = extractLotId(c.rawValue);
            if (id && open(id)) { cancelled = true; return; }
            if (!id) setError('That QR code is not a lot label.');
          }
        }
      } catch {
        // A frame that fails to decode is skipped.
      }
      if (!cancelled) timer = setTimeout(tick, 250);
    };
    void tick();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [camera, open]);

  useEffect(() => stop, [stop]);

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const id = manual.trim().toUpperCase();
    if (!isValidLotId(id)) {
      const parsed = parseLotId(id);
      setError(parsed.ok ? 'Not a valid lot ID' : parsed.error);
      return;
    }
    open(id);
  }

  const cameraMessage: Record<CameraState, string | null> = {
    idle: null,
    starting: 'Starting camera…',
    scanning: 'Point at the QR label on the lot board',
    unsupported: 'This browser cannot read QR codes. Type the lot ID below.',
    denied: 'Camera permission is off. Allow it in browser settings, or type the lot ID below.',
    error: 'The camera could not start. Type the lot ID below.',
  };

  return (
    <>
      <SubHeader title="Scan lot QR" back={null} subtitle="Opens the stage that is due" />
      <div className="flex flex-1 flex-col gap-4 px-3.5 pt-3.5 pb-6">
        <section className="relative overflow-hidden rounded-[20px] bg-forest">
          <video ref={videoRef} playsInline muted className={cx('aspect-square w-full object-cover', camera === 'scanning' ? 'block' : 'hidden')} />
          {camera === 'scanning' && (
            <div aria-hidden="true" className="pointer-events-none absolute inset-[18%] rounded-2xl border-[3px] border-leaf shadow-[0_0_0_999px_rgba(13,28,21,0.45)]" />
          )}
          {camera !== 'scanning' && (
            <div className="flex aspect-[4/3] flex-col items-center justify-center gap-4 px-6 text-center text-forest-text">
              <span className="flex size-14 items-center justify-center rounded-full bg-forest-3 text-leaf"><Icon name="qr" size={28} /></span>
              {cameraMessage[camera] && <p className="text-[14px] leading-relaxed">{cameraMessage[camera]}</p>}
              {(camera === 'idle' || camera === 'denied' || camera === 'error') && supported && (
                <button type="button" onClick={() => void start()} className="flex h-[50px] items-center gap-2 rounded-[14px] bg-leaf px-6 text-[15px] font-semibold text-forest">
                  <Icon name="camera" size={18} /> {camera === 'idle' ? 'Start camera' : 'Try again'}
                </button>
              )}
              {camera === 'idle' && supported === false && <p className="text-[14px]">{cameraMessage.unsupported}</p>}
            </div>
          )}
          {camera === 'scanning' && (
            <p className="absolute inset-x-0 bottom-0 bg-forest/80 px-4 py-2.5 text-center text-[13px] text-white">{cameraMessage.scanning}</p>
          )}
        </section>

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-2xl bg-signal-tint px-3.5 py-3 text-[13.5px] text-signal-text">
            <Icon name="alert" size={17} strokeWidth={2} className="mt-px flex-none" /> {error}
          </p>
        )}

        <form onSubmit={submitManual} className="flex flex-col gap-[7px]" noValidate>
          <label htmlFor="lot-id" className="text-[13px] font-medium">Or type the lot ID</label>
          <div className="flex gap-2">
            <input
              id="lot-id"
              value={manual}
              onChange={(e) => { setManual(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 21)); setError(null); }}
              placeholder="0126HP2041015TS004201"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="h-[50px] min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-3.5 font-mono text-[15px] tracking-[0.02em] outline-none focus:border-brand"
            />
            <button type="submit" disabled={manual.length === 0} className="h-[50px] flex-none rounded-xl bg-brand px-5 text-[15px] font-semibold text-white disabled:opacity-50">Open</button>
          </div>
          <p className="text-[12px] text-muted">{manual.length}/21 characters</p>
        </form>
      </div>
    </>
  );
}
