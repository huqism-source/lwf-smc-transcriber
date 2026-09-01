export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: "URL درکار ہے۔" });

  try {
    // Step 1: Analyze YouTube Link via Y2Mate API
    const analyzeRes = await fetch('https://www.y2mate.com/matemy/analyzeV2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      body: new URLSearchParams({ k_query: url, k_page: 'home', q_auto: '1' })
    });

    const analyzeData = await analyzeRes.json();
    if (!analyzeData || !analyzeData.links || !analyzeData.links.mp3) {
      throw new Error("یوٹیوب ویڈیو اینالائز نہیں ہو سکی۔");
    }

    // Get MP3 Key
    const mp3Key = Object.values(analyzeData.links.mp3)[0]?.k;
    if (!mp3Key) throw new Error("آڈیو فارمیٹ دستیاب نہیں ہے۔");

    // Step 2: Convert to downloadable MP3 URL
    const convertRes = await fetch('https://www.y2mate.com/matemy/convertV2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      body: new URLSearchParams({ vid: analyzeData.vid, k: mp3Key })
    });

    const convertData = await convertRes.json();
    if (convertData.status === 'success' && convertData.dlink) {
      return res.status(200).json({ url: convertData.dlink });
    } else {
      throw new Error("ڈاؤن لوڈ لنک تیار نہیں ہو سکا۔");
    }

  } catch (err) {
    return res.status(500).json({ error: "یوٹیوب آڈیو کا سورس حاصل کرنے میں ناکامی ہوئی: " + err.message });
  }
}
