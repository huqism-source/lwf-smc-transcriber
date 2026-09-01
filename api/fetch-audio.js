export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "URL zaroori hai" });
  }

  try {
    // Cobalt API request for audio
    const cobaltRes = await fetch("https://api.cobalt.tools/", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: url,
        downloadMode: "audio",
        audioFormat: "mp3"
      })
    });

    const data = await cobaltRes.json();

    if (data.status === "error" || !data.url) {
      return res.status(400).json({ 
        error: "Video se audio nahi mila. Link check karein ya direct upload karein." 
      });
    }

    // Audio stream/file fetch kar ke client ko bhejna
    const audioStream = await fetch(data.url);
    
    res.setHeader("Content-Type", "audio/mpeg");
    const arrayBuffer = await audioStream.arrayBuffer();
    return res.status(200).send(Buffer.from(arrayBuffer));

  } catch (error) {
    console.error("Cobalt Fetch Error:", error);
    return res.status(500).json({ 
      error: "Audio fetch karne mein masla aaya. Wajah: " + error.message 
    });
  }
}
