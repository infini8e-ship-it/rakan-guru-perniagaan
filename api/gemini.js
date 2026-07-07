// Proksi Gemini untuk Versi Percuma — key pusat dalam env var GEMINI_API_KEY (tidak didedahkan ke pelayar)
const kuotaIP = new Map(); // had lembut per IP per instans

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST sahaja' });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: 'BELUM_AKTIF' });

  // Had lembut: 60 permintaan/jam per IP (halang skrip automatik)
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0] || 'x';
  const kini = Date.now();
  const rekod = kuotaIP.get(ip) || { kira: 0, mula: kini };
  if (kini - rekod.mula > 3600e3) { rekod.kira = 0; rekod.mula = kini; }
  if (++rekod.kira > 60) return res.status(429).json({ error: 'Had penggunaan dicapai. Cuba sebentar lagi atau guna API sendiri.' });
  kuotaIP.set(ip, rekod);

  const { model = 'gemini-2.5-flash', sistem = '', contents, generationConfig } = req.body || {};
  if (!Array.isArray(contents)) return res.status(400).json({ error: 'contents diperlukan' });
  const modelSah = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
  const m = modelSah.includes(model) ? model : 'gemini-2.5-flash';

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: sistem }] },
        contents,
        generationConfig: generationConfig || { temperature: 0.6, maxOutputTokens: 4096 }
      })
    });
    const j = await r.json();
    return res.status(r.status).json(j);
  } catch (e) {
    return res.status(502).json({ error: 'Gagal menghubungi Gemini' });
  }
}
