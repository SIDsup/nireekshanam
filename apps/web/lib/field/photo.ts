'use client';

export interface WatermarkInfo {
  lotId: string;
  capturedAt: Date;
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
}

export interface ProcessedPhoto {
  blob: Blob;
  width: number;
  height: number;
}

const MAX_EDGE = 1600;
/** SPECS §3.6: photos are compressed to about 300 KB. */
const TARGET_BYTES = 300 * 1024;

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if ('createImageBitmap' in window) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      // Fall through to <img> decoding (older WebViews, HEIC on some devices).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode photo'))), 'image/jpeg', quality));
}

function stamp(d: Date): string {
  const ist = new Date(d.getTime() + 5.5 * 3600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(ist.getUTCDate())}-${p(ist.getUTCMonth() + 1)}-${ist.getUTCFullYear()} ${p(ist.getUTCHours())}:${p(ist.getUTCMinutes())} IST`;
}

/**
 * Resizes a camera photo to at most 1600 px on the long edge, burns a watermark strip with the
 * lot ID, date-time and GPS into it, and encodes a JPEG of about 300 KB (quality 0.7 first).
 */
export async function processPhoto(file: Blob, info: WatermarkInfo): Promise<ProcessedPhoto> {
  const img = await decode(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas is not available');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img.source, 0, 0, width, height);

    // Watermark strip along the bottom edge.
    const font = Math.max(14, Math.round(Math.min(width, height) * 0.03));
    const pad = Math.round(font * 0.6);
    const strip = font * 2 + pad * 3;
    ctx.fillStyle = 'rgba(13, 28, 21, 0.78)';
    ctx.fillRect(0, height - strip, width, strip);
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top';
    ctx.font = `600 ${font}px ui-monospace, "Geist Mono", monospace`;
    ctx.fillText(info.lotId, pad, height - strip + pad, width - pad * 2);
    ctx.font = `400 ${font}px ui-monospace, "Geist Mono", monospace`;
    const gps = info.lat !== null && info.lng !== null
      ? `${info.lat.toFixed(5)}, ${info.lng.toFixed(5)}${info.accuracyM !== null ? ` ±${Math.round(info.accuracyM)} m` : ''}`
      : 'GPS not available';
    ctx.fillText(`${stamp(info.capturedAt)} · ${gps}`, pad, height - strip + pad * 2 + font, width - pad * 2);

    let quality = 0.7;
    let blob = await toBlob(canvas, quality);
    while (blob.size > TARGET_BYTES && quality > 0.45) {
      quality -= 0.1;
      blob = await toBlob(canvas, quality);
    }
    // Free the canvas memory right away (matters on 2 GB phones).
    canvas.width = 0;
    canvas.height = 0;
    return { blob, width, height };
  } finally {
    img.close();
  }
}
