export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: "URL درکار ہے۔" });

  try {
    // 1. YouTube Video ID نکالیں
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    const videoId = (match && match[2].length === 11) ? match[2] : null;

    if (!videoId) {
      return res.status(400).json({ error: "برائے مہربانی یوٹیوب کا درست لنک درج کریں۔" });
    }

    // 2. Direct Worker Fetcher Endpoint
    const streamUrl = `https://youtube-downloader-worker.workers.dev/?id=${videoId}`;
    
    // Testing direct proxy audio stream
    return res.status(200).json({ url: streamUrl });

  } catch (err) {
    return res.status(500).json({ error: "آڈیو لنک جنریٹ کرنے میں ناکامی ہوئی۔" });
  }
}
