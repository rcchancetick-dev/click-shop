import { createClient } from '@supabase/supabase-js';
const adminClient = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
async function requireAdmin(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) throw new Error('UNAUTHORIZED');
  const supabase = adminClient();
  const { data, error } = await supabase.auth.getUser(auth.slice(7));
  if (error || !data.user) throw new Error('UNAUTHORIZED');
  const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
  if (profileError || profile?.role !== 'admin') throw new Error('FORBIDDEN');
  return data.user;
}
const NATIONAL_COUNTRY = (process.env.NATIONAL_COUNTRY || 'MG').toUpperCase();
const NATIONAL_CURRENCY = process.env.NATIONAL_CURRENCY || 'MGA';
const INTL_CURRENCY = process.env.INTL_CURRENCY || 'EUR';
function priceFor(p, country) {
  const { price_intl, old_price_intl, ...rest } = p;
  return country === NATIONAL_COUNTRY ? { ...rest, currency: NATIONAL_CURRENCY } : { ...rest, price: price_intl ?? p.price, old_price: old_price_intl ?? null, currency: INTL_CURRENCY };
}
const FIELDS = ['name','slug','description','category','format','price','old_price','price_intl','old_price_intl','image','badge','published'];
function clean(body) {
  const out = {};
  for (const k of FIELDS) if (body[k] !== undefined) out[k] = body[k];
  if (out.price !== undefined) out.price = Number(out.price);
  if (out.old_price !== undefined) out.old_price = out.old_price ? Number(out.old_price) : null;
  if (out.price_intl !== undefined) out.price_intl = out.price_intl === '' || out.price_intl === null ? null : Number(out.price_intl);
  if (out.old_price_intl !== undefined) out.old_price_intl = out.old_price_intl ? Number(out.old_price_intl) : null;
  if (out.badge !== undefined) out.badge = out.badge || null;
  if (out.published !== undefined) out.published = Boolean(out.published);
  return out;
}
async function saveFile(supabase, productId, url) {
  if (url === undefined) return;
  if (url) {
    const { error } = await supabase.from('product_files').upsert({ product_id: productId, download_url: url });
    if (error) throw new Error(error.message);
  } else {
    await supabase.from('product_files').delete().eq('product_id', productId);
  }
}
const flatten = p => {
  const f = Array.isArray(p.product_files) ? p.product_files[0] : p.product_files;
  const { product_files, ...rest } = p;
  return { ...rest, download_url: f?.download_url || '' };
};
export default async function handler(req, res) {
  const supabase = adminClient();
  try {
    if (req.method === 'GET') {
      if (req.query.admin) {
        await requireAdmin(req);
        const { data, error } = await supabase.from('products').select('*, product_files(download_url)').order('created_at', { ascending: false });
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ products: data.map(flatten), config: { nationalCurrency: NATIONAL_CURRENCY, intlCurrency: INTL_CURRENCY } });
      }
      const country = String(req.query.country || '').toUpperCase();
      if (!/^[A-Z]{2}$/.test(country)) return res.status(400).json({ error: 'Pays requis.' });
      const { data, error } = await supabase.from('products').select('*').eq('published', true).order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ products: data.map(p => priceFor(p, country)) });
    }
    await requireAdmin(req);
    if (req.method === 'POST') {
      const body = req.body || {};
      if (!body.name || !body.price || !body.price_intl || !body.image) return res.status(400).json({ error: "Le nom, les deux prix et l'image sont requis." });
      const base = String(body.name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const row = clean(body);
      row.slug = `${base || 'produit'}-${Date.now().toString(36)}`;
      row.category = row.category || 'Ebooks';
      row.format = row.format || 'PDF';
      const { data, error } = await supabase.from('products').insert(row).select().single();
      if (error) return res.status(500).json({ error: error.message });
      await saveFile(supabase, data.id, body.download_url);
      return res.status(201).json({ product: { ...data, download_url: body.download_url || '' } });
    }
    if (req.method === 'PUT') {
      const body = req.body || {};
      if (!body.id) return res.status(400).json({ error: 'id requis.' });
      const { data, error } = await supabase.from('products').update(clean(body)).eq('id', body.id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      await saveFile(supabase, body.id, body.download_url);
      return res.status(200).json({ product: { ...data, download_url: body.download_url || '' } });
    }
    if (req.method === 'DELETE') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'id requis.' });
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(204).end();
    }
    res.setHeader('Allow', 'GET, POST, PUT, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    const status = error.message === 'FORBIDDEN' ? 403 : error.message === 'UNAUTHORIZED' ? 401 : 500;
    return res.status(status).json({ error: error.message || 'Erreur serveur' });
  }
}
