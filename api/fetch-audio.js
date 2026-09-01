export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.body || {};
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  // Working public Cobalt instances
  const instances = [
    'https://cobalt-api.kwiatekm.com',
    'https://co.wuk.sh',
    'https://api.cobalt.tools'
  ];

  for (const instance of instances) {
    try {
      const response = await fetch(instance, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        body: JSON.stringify({
          url: url,
          downloadMode: 'audio',
          audioFormat: 'mp3'
        })
      });

      if (response.ok) {
        const data = await response.json();
        // Check standard cobalt response structures
        const audioUrl = data.url || (data.picker && data.picker[0] && data.picker[0].url);
        if (audioUrl) {
          return res.status(200).json({ url: audioUrl });
        }
      }
    } catch (e) {
      continue;
    }
  }

  return res.status(500).json({ error: "یوٹیوب آڈیو کا سورس حاصل کرنے میں ناکامی ہوئی اور تمام سرورز مصروف ہیں۔ براہ کرم کچھ دیر بعد کوشش کریں۔" });
}
