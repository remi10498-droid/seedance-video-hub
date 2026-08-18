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

    // Точные адреса Picsart GenAI для проверки inference_id
    const endpoints = [
      `https://genai-api.picsart.io/v1/inferences?inference_id=${id}`,
      `https://genai-api.picsart.io/v1/text2video/inferences/${id}`,
      `https://genai-api.picsart.io/v1/image2video/inferences/${id}`,
      `https://genai-api.picsart.io/v1/inferences/${id}`
    ];

    let rawData = null;
    let lastStatus = 0;
    let lastErrorText = "";

    for (const url of endpoints) {
      try {
        const res = await fetch(url, { headers });
        lastStatus = res.status;
        if (res.ok) {
          rawData = await res.json();
          break;
        } else {
          lastErrorText = await res.text();
        }
      } catch (e) {
        lastErrorText = e.message;
      }
    }

    if (!rawData) {
      return Response.json({
        debug_error: true,
        picsart_http_status: lastStatus,
        picsart_response: lastErrorText
      }, { status: 200 });
    }

    // Извлечение прямой ссылки на видео из структуры ответа
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
