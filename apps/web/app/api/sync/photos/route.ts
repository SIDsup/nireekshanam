/**
 * Photo upload (SPECS §3.6, §6.1 step 4). The demo build has no object storage, so the
 * server checks the upload and acknowledges it without keeping the bytes.
 */
const MAX_BYTES = 1_500_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const globalForUploads = globalThis as unknown as { __nkPhotoUploads?: Map<string, { recordUuid: string; size: number; at: string }> };
const uploads = () => (globalForUploads.__nkPhotoUploads ??= new Map());

export async function POST(req: Request) {
  const url = new URL(req.url);
  const photoId = url.searchParams.get('id') ?? '';
  const recordUuid = url.searchParams.get('record') ?? '';
  if (!UUID.test(photoId) || !UUID.test(recordUuid)) return Response.json({ error: 'id and record must be UUIDs' }, { status: 400 });
  if (!(req.headers.get('content-type') ?? '').startsWith('image/jpeg')) return Response.json({ error: 'Upload a JPEG' }, { status: 415 });
  const bytes = await req.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return Response.json({ error: 'Photo is empty or too large' }, { status: 413 });
  uploads().set(photoId, { recordUuid, size: bytes.byteLength, at: new Date().toISOString() });
  return Response.json({ id: photoId, size: bytes.byteLength });
}
