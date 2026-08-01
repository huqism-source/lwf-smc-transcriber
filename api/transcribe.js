// POST /api/transcribe?lang=ur&offset=0
// Body: raw 16kHz mono WAV bytes (application/octet-stream)
// Returns: { segments: [{start,dur,text}], text }
//
// Vercel Environment Variable chahiye: GROQ_API_KEY

const MODEL = process.env.GROQ_MODEL || "whisper-large-v3";

function json(res, status, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).send(JSON.stringify(payload));
}

function readBody(req) {
  if (req.body && Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    const parts = [];
    req.on("data", (c) => parts.push(c));
    req.on("end", () => resolve(Buffer.concat(parts)));
    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "post_only" });

  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return json(res, 501, {
      error: "no_key",
      message:
        "GROQ_API_KEY set nahi hai. Vercel mein Settings → Environment Variables se add karein, phir redeploy karein.",
    });
  }

  const lang = String(req.query.lang || "").trim();
  const offset = parseFloat(req.query.offset || "0") || 0;

  try {
    const audio = await readBody(req);
    if (!audio || audio.length < 1000) {
      return json(res, 400, { error: "empty_audio", message: "Audio chunk khali hai." });
    }

    const form = new FormData();
    form.append("file", new Blob([audio], { type: "audio/wav" }), "chunk.wav");
    form.append("model", MODEL);
    form.append("response_format", "verbose_json");
    form.append("temperature", "0");
    if (lang && lang !== "auto") form.append("language", lang);

    const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });

    const data = await r.json();

    if (!r.ok) {
      return json(res, r.status, {
        error: "groq_error",
        message: data?.error?.message || "Groq ne request qubool nahi ki.",
      });
    }

    const segments = (data.segments || []).map((s) => ({
      start: offset + (s.start || 0),
      dur: Math.max(0, (s.end || 0) - (s.start || 0)),
      text: String(s.text || "").trim(),
    })).filter((s) => s.text);

    // Agar verbose segments na milein to poora text ek block ke tor par.
    if (!segments.length && data.text) {
      segments.push({ start: offset, dur: 0, text: String(data.text).trim() });
    }

    return json(res, 200, {
      language: data.language || lang || null,
      segments,
    });
  } catch (err) {
    return json(res, 502, {
      error: "transcribe_failed",
      message: "Transcription mukammal nahi ho saki.",
      detail: String(err && err.message ? err.message : err),
    });
  }
};
