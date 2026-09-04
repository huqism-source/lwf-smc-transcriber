// GET /api/fetch-audio?url=<youtube_url>
// Youtube link se audio-only stream nikal ke seedha response mein bhej deta hai.
// Browser isay File object bana ke usi purane pipeline (toMono16k -> /api/transcribe) mein daal deta hai.
//
// @distube/ytdl-core istemal ho raha hai (plain CommonJS, Vercel par reliably load hoti hai).
// YT_COOKIE set hone par logged-in account ki tarah request bhejta hai, jo YouTube ki
// "Sign in to confirm you're not a bot" wali datacenter-IP blocking ko bypass kar deta hai.
//
// Optional Vercel Environment Variables:
//   MAX_DURATION_SEC (default 2400 = 40 minute)
//   YT_COOKIE (apne YouTube account ka cookie header string — SETUP.md mein tareeqa hai)
//
// npm dependency chahiye: @distube/ytdl-core

const MAX_DURATION_SEC = parseInt(process.env.MAX_DURATION_SEC || "2400", 10);

function json(res, status, payload) {
  try {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(status).send(JSON.stringify(payload));
  } catch (e) {}
}

// "name1=value1; name2=value2" (Cookie-Editor "Header String" export) ko
// ytdl.createAgent() ke chahiye array format mein badalta hai.
function parseCookieHeader(str) {
  if (!str || !str.trim()) return null;
  const list = str
    .split(";")
    .map((pair) => {
      const idx = pair.indexOf("=");
      if (idx === -1) return null;
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      if (!name) return null;
      return { name, value, domain: ".youtube.com" };
    })
    .filter(Boolean);
  return list.length ? list : null;
}

let agentCache = undefined; // undefined = not built yet, null = no cookie available
function getAgent(ytdl) {
  if (agentCache === undefined) {
    const cookies = parseCookieHeader(process.env.YT_COOKIE);
    agentCache = cookies ? ytdl.createAgent(cookies) : null;
  }
  return agentCache;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") return json(res, 405, { error: "get_only" });

    const url = String((req.query && req.query.url) || "").trim();
    if (!url) {
      return json(res, 400, {
        error: "bad_url",
        message: "Sahi YouTube link dain (youtube.com ya youtu.be).",
      });
    }

    let ytdl;
    try {
      ytdl = require("@distube/ytdl-core");
    } catch (err) {
      return json(res, 500, {
        error: "package_load_failed",
        message: "Server par @distube/ytdl-core package load nahi hui. package.json mein dependency check karein aur redeploy karein.",
        detail: String(err && err.message ? err.message : err),
      });
    }

    if (!ytdl.validateURL(url)) {
      return json(res, 400, {
        error: "bad_url",
        message: "Sahi YouTube link dain (youtube.com ya youtu.be).",
      });
    }

    const agent = getAgent(ytdl);
    const reqOpts = agent ? { agent } : undefined;

    let info;
    try {
      info = await ytdl.getInfo(url, reqOpts);
    } catch (err) {
      return json(res, 502, {
        error: "fetch_failed",
        message: "Video ki info nahi mili. Link check karein, ya YT_COOKIE set/update karein (SETUP.md).",
        detail: String(err && err.message ? err.message : err),
      });
    }

    const duration = parseInt((info.videoDetails && info.videoDetails.lengthSeconds) || "0", 10);
    if (duration > MAX_DURATION_SEC) {
      return json(res, 413, {
        error: "too_long",
        message:
          "Ye video " +
          Math.round(MAX_DURATION_SEC / 60) +
          " minute ki limit se lambi hai. Chota video try karein.",
      });
    }

    const format = ytdl.chooseFormat(info.formats, { quality: "lowestaudio", filter: "audioonly" });
    if (!format) {
      return json(res, 422, {
        error: "no_audio",
        message: "Is video mein alag audio stream nahi mila.",
      });
    }

    const title = ((info.videoDetails && info.videoDetails.title) || "audio").slice(0, 120);

    res.setHeader("Content-Type", format.mimeType ? format.mimeType.split(";")[0] : "audio/webm");
    res.setHeader("X-Video-Title", encodeURIComponent(title));
    res.setHeader("Cache-Control", "no-store");

    await new Promise((resolve, reject) => {
      const stream = ytdl.downloadFromInfo(info, { format, ...(agent ? { agent } : {}) });
      stream.on("error", reject);
      res.on("close", resolve);
      res.on("error", reject);
      stream.on("end", resolve);
      stream.pipe(res);
    });
  } catch (fatal) {
    if (!res.headersSent) {
      json(res, 500, {
        error: "unexpected",
        message: "Kuch anokha masla aaya. Dobara try karein.",
        detail: String(fatal && fatal.message ? fatal.message : fatal),
      });
    } else {
      try { res.end(); } catch (e) {}
    }
  }
};
