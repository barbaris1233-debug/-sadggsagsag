export const config = { maxDuration: 10 };

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const { username, token } = req.body ?? {};
  if (!username || !token) { res.status(400).json({ error: 'missing params' }); return; }

  try {
    const r = await fetch(
      `https://api.telegram.org/bot${token}/getChat?chat_id=@${username}`,
      { signal: AbortSignal.timeout(8000) },
    );
    const data = await r.json();
    res.status(r.status).json(data);
  } catch {
    res.status(500).json({ ok: false });
  }
}
