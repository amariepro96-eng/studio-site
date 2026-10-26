import { config, agencyToken } from '../../../src/server/config.js';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const { agencyPassword } = config();
  if (!agencyPassword) return Response.json({ ok: true });
  let password = '';
  try {
    password = String((await req.json())?.password || '');
  } catch {}
  if (password !== agencyPassword) {
    return Response.json({ ok: false, error: 'Mot de passe incorrect.' }, { status: 401 });
  }
  const res = Response.json({ ok: true });
  res.headers.append(
    'Set-Cookie',
    `agence=${agencyToken(agencyPassword)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
  );
  return res;
}
