import { cookies } from 'next/headers';
import { db } from './data/store';
import type { AppUser } from './data/types';

export const SESSION_COOKIE = 'nk_session';

const secret = () => process.env.SESSION_SECRET ?? 'nireekshanam-demo-secret';

async function hmac(value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Buffer.from(sig).toString('base64url');
}

export async function signSession(userId: string): Promise<string> {
  return `${userId}.${await hmac(userId)}`;
}

export async function verifySession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const i = token.lastIndexOf('.');
  if (i < 1) return null;
  const userId = token.slice(0, i);
  return (await hmac(userId)) === token.slice(i + 1) ? userId : null;
}

export async function currentUser(): Promise<AppUser | null> {
  const store = await cookies();
  const id = await verifySession(store.get(SESSION_COOKIE)?.value);
  return id ? db().users.find((u) => u.id === id) ?? null : null;
}

/** Demo default when no session exists (e.g. previews): the production manager. */
export async function viewer(): Promise<AppUser> {
  return (await currentUser()) ?? db().users.find((u) => u.role === 'PRODUCTION_MANAGER')!;
}
