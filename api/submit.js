// Vercel serverless function: receives the form and posts it to your Discord channel.
// Set DISCORD_WEBHOOK_URL in your Vercel project's Environment Variables.

const hits = new Map(); // simple per-IP rate limit (resets on cold start)

const clip = (v, n) => String(v ?? '').trim().slice(0, n);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0] || 'unknown';
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < 10 * 60 * 1000);
  if (recent.length >= 5) return res.status(429).json({ error: 'Too many requests' });
  hits.set(ip, [...recent, now]);

  const b = req.body || {};
  if (b.website) return res.status(200).json({ ok: true }); // honeypot: bots fill this

  const name = clip(b.name, 80), contact = clip(b.contact, 120), item = clip(b.item, 120);
  const price = clip(b.price, 12);
  if (!name || !contact || !item || !price) return res.status(400).json({ error: 'Missing fields' });

  const image = /^https?:\/\//i.test(b.image || '') ? clip(b.image, 300) : '';

  const embed = {
    title: `New sell request: ${item}`,
    color: 0x4f46e5,
    fields: [
      { name: 'Name', value: name, inline: true },
      { name: 'Contact', value: contact, inline: true },
      { name: 'Price', value: `₹${price}`, inline: true },
      { name: 'Category', value: clip(b.category, 40) || '-', inline: true },
      { name: 'Condition', value: clip(b.condition, 40) || '-', inline: true },
      { name: 'Location', value: clip(b.location, 100) || '-', inline: true },
      { name: 'Description', value: clip(b.desc, 800) || '-' },
    ],
    timestamp: new Date().toISOString(),
  };
  if (image) embed.image = { url: image };

  const r = await fetch(process.env.DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] } }),
  });

  if (!r.ok) return res.status(502).json({ error: 'Discord error' });
  res.status(200).json({ ok: true });
}
  
