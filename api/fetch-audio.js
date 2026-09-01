// GET /api/fetch-audio?url=<youtube_url>
// Youtube link se audio-only stream nikal ke seedha response mein bhej deta hai.
// Browser isay File object bana ke usi purane pipeline (toMono16k -> /api/transcribe) mein daal deta hai.
//
// Optional Vercel Environment Variable: MAX_DURATION_SEC (default 2400 = 40 minute)
//
// npm dependency chahiye: @distube/ytdl-core

const ytdl = require("@distube/ytdl-core");

const MAX_DURATION_SEC = parseInt(process.env.MAX_DURATION_SEC || "2400", 10);

function json(res, status, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).send(JSON.stringify(payload));
}

module.exports = async (req, res) => {
  if (req.method !== "GET") return json(res, 405, { error: "get_only" });

  const url = String(req.query.url || "").trim();
  if (!url || !ytdl.validateURL(url)) {
    return json(res, 400, {
      error: "bad_url",
      message: "Sahi YouTube link dain (youtube.com ya youtu.be).",
    });
  }

  try {
    const info = await ytdl.getInfo(url);

    const duration = parseInt(info.videoDetails.lengthSeconds || "0", 10);
    if (duration > MAX_DURATION_SEC) {
      return json(res, 413, {
        error: "too_long",
        message:
          "Ye video " +
          Math.round(MAX_DURATION_SEC / 60) +
          " minute ki limit se lambi hai. Chota video try karein.",
      });
    }

    const format = ytdl.chooseFormat(info.formats, {
      quality: "lowestaudio",
      filter: "audioonly",
    });
    if (!format) {
      return json(res, 422, {
        error: "no_audio",
        message: "Is video mein alag audio stream nahi mila.",
      });
    }

    const title = (info.videoDetails.title || "audio").slice(0, 120);
    res.setHeader(
      "Content-Type",
      format.mimeType ? format.mimeType.split(";")[0] : "audio/webm"
    );
    res.setHeader("X-Video-Title", encodeURIComponent(title));
    res.setHeader("Cache-Control", "no-store");

    const stream = ytdl.downloadFromInfo(info, { format });
    stream.on("error", (err) => {
      if (!res.headersSent) {
        json(res, 502, {
          error: "stream_failed",
          message: "Audio download beech mein ruk gaya.",
          detail: String(err && err.message ? err.message : err),
        });
      } else {
        res.end();
      }
    });
    stream.pipe(res);
  } catch (err) {
    return json(res, 502, {
      error: "fetch_failed",
      message: "Video se audio nahi mila. Link check karein ya dobara koshish karein.",
      detail: String(err && err.message ? err.message : err),
    });
  }
};
