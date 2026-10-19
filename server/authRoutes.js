import { createClient } from '@supabase/supabase-js';
import { randomBytes, timingSafeEqual, createHash, scrypt } from 'node:crypto';
import { promisify } from 'node:util';

const cookieName = 'book_session';
const lifetime = 8 * 60 * 60 * 1000;
const digest = (value) => createHash('sha256').update(value).digest();
const deriveKey = promisify(scrypt);

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await deriveKey(password, salt, 64);
  return `scrypt:${salt}:${key.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  if (!stored.startsWith('scrypt:')) return timingSafeEqual(digest(password), digest(stored));
  const parts = stored.split(':');
  if (parts.length !== 3 || !/^[a-f0-9]{32}$/.test(parts[1]) || !/^[a-f0-9]{128}$/.test(parts[2])) return false;
  const key = await deriveKey(password, parts[1], 64);
  return timingSafeEqual(key, Buffer.from(parts[2], 'hex'));
}

export function registerAuthRoutes(app, { findUser } = {}) {
  const sessions = new Map();
  const attempts = new Map();
  let client;
  const lookup = findUser || (async (usuario) => {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      const error = new Error('Missing server authentication configuration');
      error.code = 'AUTH_CONFIG_MISSING';
      throw error;
    }
    client ||= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.from('usuarios').select('usuario,senha').eq('usuario', usuario).limit(2);
    if (error) throw error;
    return data?.length === 1 ? data[0] : null;
  });
  const tokenFrom = (req) => (req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  const cookie = (res, token, maxAge) => res.cookie(cookieName, token, {
    httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/', maxAge,
  });
  app.use('/api/auth', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.post('/api/auth/login', async (req, res) => {
    const { usuario, senha } = req.body || {};
    if (typeof usuario !== 'string' || !usuario.trim() || usuario.length > 254 || typeof senha !== 'string' || !senha || senha.length > 1024) {
      return res.status(400).json({ message: 'Informe usuario e senha.' });
    }
    const now = Date.now();
    for (const [key, value] of attempts) if (value.expires <= now) attempts.delete(key);
    for (const [key, value] of sessions) if (value.expires <= now) sessions.delete(key);
    const key = req.ip;
    const attempt = attempts.get(key) || { count: 0, expires: now + 15 * 60 * 1000 };
    if (attempt.count >= 10) return res.status(429).json({ message: 'Muitas tentativas. Aguarde 15 minutos.' });
    attempt.count += 1;
    attempts.set(key, attempt);
    try {
      const record = await lookup(usuario.trim());
      const valid = await verifyPassword(senha, record?.senha);
      if (!record || !valid) return res.status(401).json({ message: 'Usuario ou senha incorretos.' });
      // Upgrade existing plain-text passwords only after successful validation.
      if (!findUser && !record.senha.startsWith('scrypt:')) {
        const { error } = await client.from('usuarios').update({ senha: await hashPassword(senha) })
          .eq('usuario', record.usuario).eq('senha', record.senha);
        if (error) throw error;
      }
      const user = { usuario: record.usuario, email: record.usuario, app_metadata: { provider: 'usuarios' }, user_metadata: {} };
      const token = randomBytes(32).toString('hex');
      sessions.delete(tokenFrom(req));
      sessions.set(token, { user, expires: now + lifetime });
      attempts.delete(key);
      cookie(res, token, lifetime);
      return res.json({ user });
    } catch (error) {
      if (error.code === 'AUTH_CONFIG_MISSING') {
        return res.status(503).json({ message: 'Login nao configurado: defina VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local e reinicie o servidor.' });
      }
      return res.status(503).json({ message: 'Nao foi possivel consultar a tabela usuarios. Verifique a configuracao do servidor.' });
    }
  });
  app.get('/api/auth/session', (req, res) => {
    const token = tokenFrom(req);
    const session = sessions.get(token);
    if (!session || session.expires <= Date.now()) {
      sessions.delete(token);
      return res.status(401).json({ user: null });
    }
    return res.json({ user: session.user });
  });
  app.post('/api/auth/logout', (req, res) => {
    sessions.delete(tokenFrom(req));
    cookie(res, '', 0);
    res.json({ user: null });
  });
}
