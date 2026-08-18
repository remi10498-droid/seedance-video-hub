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

    // Точный рабочий роут Picsart Video API
    const res = await fetch(`https://genai-api.picsart.io/v1/video/${id}`, { headers });
    const rawData = await res.json().catch(() => null);

    if (!res.ok) {
      const errMsg = rawData?.detail || rawData?.message || `Ошибка API: статус ${res.status}`;
      return Response.json({
        status: "FAILED",
        error: errMsg
      }, { status: 200 });
    }

    // Извлечение видеофайла
    let videoUrl = null;
    if (rawData?.data) {
      if (Array.isArray(rawData.data) && rawData.data[0]) {
        videoUrl = rawData.data[0].url || rawData.data[0].video_url || (typeof rawData.data[0] === 'string' ? rawData.data[0] : null);
      } else if (typeof rawData.data === 'object') {
        videoUrl = rawData.data.url || rawData.data.video_url || rawData.data.result;
      }
    }
    if (!videoUrl && rawData?.result) {
      videoUrl = Array.isArray(rawData.result) ? rawData.result[0]?.url : (rawData.result?.url || rawData.result);
    }
    if (!videoUrl && rawData?.url) {
      videoUrl = rawData.url;
    }

    const currentStatus = String(rawData?.status || rawData?.state || "").toUpperCase();
    const isDone = currentStatus === "SUCCESS" || currentStatus === "DONE" || currentStatus === "COMPLETED";

    if (videoUrl || isDone) {
      return Response.json({
        status: "DONE",
        url: videoUrl,
        data: [{ url: videoUrl }]
      });
    }

    return Response.json({
      status: "IN_PROGRESS"
    });

  } catch (err) {
    return Response.json({
      status: "FAILED",
      error: err.message
    }, { status: 200 });
  }
}
