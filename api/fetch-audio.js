// GET /api/fetch-audio?url=<youtube_url>
// Youtube link se audio-only stream nikal ke seedha response mein bhej deta hai.
// Browser isay File object bana ke usi purane pipeline (toMono16k -> /api/transcribe) mein daal deta hai.
//
// youtubei.js istemal hota hai (@distube/ytdl-core ki jagah) kyunke ye YouTube ke
// internal (InnerTube) API ko seedha mimic karta hai — Vercel jaisay datacenter IPs se
// aane wali "Sign in to confirm you're not a bot" wali blocking ke khilaf zyada mazboot hai.
// Kayi mobile-app clients (ANDROID/IOS) try kiye jate hain taake koi ek chal jaye.
//
// Agar phir bhi "fetch_failed" aaye to YT_COOKIE environment variable set karein —
// niche getYt() se pehle wala comment dekhain, ya SETUP.md.
//
// Optional Vercel Environment Variables:
//   MAX_DURATION_SEC (default 2400 = 40 minute)
//   YT_COOKIE (apne YouTube account ka cookie header string — bot-block bypass ke liye)
//
// npm dependency chahiye: youtubei.js

const { Innertube, UniversalCache } = require("youtubei.js");
const { Readable } = require("stream");

const MAX_DURATION_SEC = parseInt(process.env.MAX_DURATION_SEC || "2400", 10);
const CLIENTS_TO_TRY = ["ANDROID", "IOS", "WEB", "TV"];

function json(res, status, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).send(JSON.stringify(payload));
}

function extractVideoId(url) {
  const m = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

// YT_COOKIE: logged-in YouTube account ka cookie header string
// (Cookie-Editor extension -> "Header String" export). Isay set karne se
// zyada tar "Sign in to confirm you're not a bot" errors khatam ho jate hain.
// Tareeqa SETUP.md mein hai.
let ytPromise = null;
function getYt() {
  if (!ytPromise) {
    const opts = { cache: new UniversalCache(false), generate_session_locally: true };
    if (process.env.YT_COOKIE) opts.cookie = process.env.YT_COOKIE;
    ytPromise = Innertube.create(opts);
  }
  return ytPromise;
}

module.exports = async (req, res) => {
  if (req.method !== "GET") return json(res, 405, { error: "get_only" });

  const url = String(req.query.url || "").trim();
  const videoId = extractVideoId(url);
  if (!videoId) {
    return json(res, 400, {
      error: "bad_url",
      message: "Sahi YouTube link dain (youtube.com ya youtu.be).",
    });
  }

  let yt;
  try {
    yt = await getYt();
  } catch (err) {
    return json(res, 502, {
      error: "init_failed",
      message: "YouTube se connection nahi ban saka. Dobara try karein.",
      detail: String(err && err.message ? err.message : err),
    });
  }

  let info;
  try {
    info = await yt.getBasicInfo(videoId);
  } catch (err) {
    return json(res, 502, {
      error: "fetch_failed",
      message: "Video ki info nahi mili. Link check karein — private ya age-restricted video kaam nahi karega.",
      detail: String(err && err.message ? err.message : err),
    });
  }

  const duration = (info && info.basic_info && info.basic_info.duration) || 0;
  if (duration > MAX_DURATION_SEC) {
    return json(res, 413, {
      error: "too_long",
      message:
        "Ye video " +
        Math.round(MAX_DURATION_SEC / 60) +
        " minute ki limit se lambi hai. Chota video try karein.",
    });
  }

  const title = ((info.basic_info && info.basic_info.title) || "audio").slice(0, 120);

  let lastErr = null;
  for (const client of CLIENTS_TO_TRY) {
    try {
      const webStream = await yt.download(videoId, {
        type: "audio",
        quality: "lowest",
        format: "any",
        client,
      });

      res.setHeader("Content-Type", "audio/webm");
      res.setHeader("X-Video-Title", encodeURIComponent(title));
      res.setHeader("Cache-Control", "no-store");

      const nodeStream = Readable.fromWeb(webStream);
      await new Promise((resolve, reject) => {
        let sent = false;
        nodeStream.on("data", () => { sent = true; });
        nodeStream.on("error", reject);
        nodeStream.on("end", resolve);
        res.on("close", resolve);
        res.on("error", reject);
        nodeStream.pipe(res);
        nodeStream.on("close", () => { if (!sent) reject(new Error("empty_stream")); });
      });
      return; // success — response already sent
    } catch (err) {
      lastErr = err;
      // is client se nahi bana, agla client try karein
    }
  }

  if (!res.headersSent) {
    json(res, 502, {
      error: "fetch_failed",
      message: "Kisi bhi tareeqay se is video ka audio nahi mila. Kuch der baad dobara try karein.",
      detail: String(lastErr && lastErr.message ? lastErr.message : lastErr),
    });
  } else {
    res.end();
  }
};
