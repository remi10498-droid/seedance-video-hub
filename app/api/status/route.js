export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return new Response(JSON.stringify({ error: "Missing ID" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    const headers = {
      "accept": "application/json",
      "X-Picsart-API-Key": process.env.PICSART_API_KEY
    };

    let rawData = null;

    // Опрашиваем эндпоинты Picsart
    let res = await fetch(`https://genai-api.picsart.io/v1/inferences/${id}`, { headers });
    if (res.ok) rawData = await res.json();

    if (!rawData) {
      res = await fetch(`https://genai-api.picsart.io/v1/tasks/${id}`, { headers });
      if (res.ok) rawData = await res.json();
    }

    if (!rawData) {
      res = await fetch(`https://genai-api.picsart.io/v1/tasks?id=${id}`, { headers });
      if (res.ok) rawData = await res.json();
    }

    if (!rawData) {
      return new Response(JSON.stringify({ status: "IN_PROGRESS" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Ищем URL видео в любых возможных полях ответа Picsart
    let videoUrl = null;
    let isDone = false;

    if (rawData.status === "SUCCESS" || rawData.status === "DONE" || rawData.state === "completed") {
      isDone = true;
    }

    if (rawData.data) {
      if (Array.isArray(rawData.data) && rawData.data[0]) {
        videoUrl = rawData.data[0].url || rawData.data[0].video_url || rawData.data[0];
      } else if (typeof rawData.data === "object") {
        videoUrl = rawData.data.url || rawData.data.video_url || rawData.data.result;
        if (rawData.data.status === "SUCCESS" || rawData.data.status === "DONE") isDone = true;
      }
    }

    if (!videoUrl && rawData.result) {
      videoUrl = Array.isArray(rawData.result) ? rawData.result[0]?.url : rawData.result?.url || rawData.result;
    }

    if (!videoUrl && rawData.url) {
      videoUrl = rawData.url;
    }

    // Если видео найдено или статус завершён
    if (videoUrl || isDone) {
      return new Response(JSON.stringify({
        status: "DONE",
        url: videoUrl,
        data: [{ url: videoUrl }]
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ status: "IN_PROGRESS" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ status: "IN_PROGRESS" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
}
