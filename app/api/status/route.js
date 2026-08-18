export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json({ error: "Missing ID" }, { status: 400 });
    }

    const headers = {
      "accept": "application/json",
      "X-Picsart-API-Key": process.env.PICSART_API_KEY
    };

    // Точные адреса для проверки статуса видео
    const endpoints = [
      `https://genai-api.picsart.io/v1/inferences/status/${id}`,
      `https://genai-api.picsart.io/v1/video/inferences/${id}`,
      `https://genai-api.picsart.io/v1/videos/inferences/${id}`,
      `https://genai-api.picsart.io/v1/video/tasks/${id}`,
      `https://genai-api.picsart.io/v1/video/${id}`,
      `https://api.picsart.io/tools/1.0/tasks?id=${id}`
    ];

    let rawData = null;
    let attempts = [];

    for (const url of endpoints) {
      try {
        const res = await fetch(url, { headers });
        const text = await res.text();
        let parsed = null;
        try {
          parsed = JSON.parse(text);
        } catch (_) {}

        attempts.push({ url, status: res.status, body: parsed || text });

        if (res.ok && parsed) {
          rawData = parsed;
          break;
        }
      } catch (e) {
        attempts.push({ url, error: e.message });
      }
    }

    if (!rawData) {
      return Response.json({
        debug_error: true,
        message: "Ни один роут не подошел",
        attempts: attempts
      }, { status: 200 });
    }

    // Извлечение ссылки на видео
    let videoUrl = null;

    if (rawData.data) {
      if (Array.isArray(rawData.data) && rawData.data[0]) {
        videoUrl = rawData.data[0].url || rawData.data[0].video_url || (typeof rawData.data[0] === 'string' ? rawData.data[0] : null);
      } else if (typeof rawData.data === 'object') {
        videoUrl = rawData.data.url || rawData.data.video_url || rawData.data.result;
      }
    }
    if (!videoUrl && rawData.result) {
      videoUrl = Array.isArray(rawData.result) ? rawData.result[0]?.url : (rawData.result?.url || rawData.result);
    }
    if (!videoUrl && rawData.url) {
      videoUrl = rawData.url;
    }

    const currentStatus = String(rawData.status || rawData.state || "").toUpperCase();
    const isDone = currentStatus === "SUCCESS" || currentStatus === "DONE" || currentStatus === "COMPLETED";

    if (videoUrl || isDone) {
      return Response.json({
        status: "DONE",
        url: videoUrl,
        data: [{ url: videoUrl }],
        raw: rawData
      });
    }

    return Response.json({
      status: "IN_PROGRESS",
      raw: rawData
    });

  } catch (err) {
    return Response.json({
      debug_exception: err.message
    }, { status: 200 });
  }
}
