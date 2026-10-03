import { cookies } from 'next/headers';

export async function POST() {
  (await cookies()).delete('nk_session');
  // Relative, so the redirect stays on the host the browser used (req.url carries the server's own host).
  return new Response(null, { status: 303, headers: { Location: '/login' } });
}
