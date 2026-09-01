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

  // Working Instances of Cobalt API v10+
  const instances = [
    'https://api.cobalt.tools',
    'https://cobalt-api.kwiatekm.com',
    'https://co.wuk.sh'
  ];

  for (const instance of instances) {
    try {
      const response = await fetch(instance, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: url,
          downloadMode: 'audio',
          audioFormat: 'mp3'
        })
      });

      if (response.ok) {
        const data = await response.json();
        return res.status(200).json(data);
      }
    } catch (e) {
      continue; // Failover to next instance
    }
  }

  return res.status(500).json({ error: "آڈیو سورس حاصل نہیں ہو سکا۔ براہ کرم دوبارہ کوشش کریں۔" });
}
