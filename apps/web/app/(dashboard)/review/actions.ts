'use server';

import { revalidatePath } from 'next/cache';
import { recordDecision, reviewQueue, undoDecision } from '@/lib/data/queries';
import { viewer } from '@/lib/session';

const REVIEWER_ROLES = new Set(['SUPERVISOR', 'PRODUCTION_MANAGER', 'ADMIN']);

async function reviewer() {
  const user = await viewer();
  if (!REVIEWER_ROLES.has(user.role)) throw new Error('Only supervisors, production managers and admins can review items');
  return user;
}

function itemIdFrom(form: FormData): string {
  const id = String(form.get('itemId') ?? '');
  if (!reviewQueue().some((i) => i.id === id)) throw new Error('That review item no longer exists');
  return id;
}

async function decide(form: FormData, decision: 'APPROVED' | 'REJECTED') {
  const user = await reviewer();
  const itemId = itemIdFrom(form);
  const comment = String(form.get('comment') ?? '').trim().slice(0, 1000);
  recordDecision(itemId, decision, comment, user.id);
  // The sidebar badge counts open items, so refresh the whole dashboard layout.
  revalidatePath('/', 'layout');
}

export async function approveItem(form: FormData) {
  await decide(form, 'APPROVED');
}

export async function rejectItem(form: FormData) {
  await decide(form, 'REJECTED');
}

export async function undoItem(form: FormData) {
  await reviewer();
  undoDecision(itemIdFrom(form));
  revalidatePath('/', 'layout');
}
