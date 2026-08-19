export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    const res = await fetch(`https://genai-api.picsart.io/v1/video/${id}`, { 
      headers,
      cache: "no-store" 
    });

    const rawData = await res.json().catch(() => null);

    if (!res.ok) {
      if (res.status === 404) {
        return Response.json({ status: "IN_PROGRESS" }, { status: 200 });
      }
      return Response.json({
        status: "FAILED",
        error: rawData?.detail || rawData?.message || `Ошибка API: ${res.status}`
      }, { status: 200 });
    }

    // Извлекаем статус Picsart
    const currentStatus = String(
      rawData?.status || 
      rawData?.state || 
      rawData?.inference_status || 
      rawData?.data?.status || 
      ""
    ).toUpperCase();

    // Извлекаем ссылку на результат
    let videoUrl = null;
    if (rawData?.data) {
      if (Array.isArray(rawData.data) && rawData.data[0]) {
        videoUrl = rawData.data[0].url || rawData.data[0].video_url || (typeof rawData.data[0] === 'string' ? rawData.data[0] : null);
      } else if (typeof rawData.data === 'object') {
        videoUrl = rawData.data.url || rawData.data.video_url || rawData.data.result;
      }
    }
    if (!videoUrl && rawData?.result) {
      videoUrl = Array.isArray(rawData.result) ? (rawData.result[0]?.url || rawData.result[0]) : (rawData.result?.url || rawData.result);
    }
    if (!videoUrl && rawData?.url) {
      videoUrl = rawData.url;
    }

    // Если генерация отклонена
    if (currentStatus === "FAILED" || currentStatus === "ERROR" || currentStatus === "REJECTED") {
      return Response.json({
        status: "FAILED",
        error: rawData?.detail || rawData?.message || rawData?.error || "Генерация отклонена нейросетью",
        raw: rawData
      });
    }

    // Видео готово ТОЛЬКО если статус явно подтверждён Picsart
    const isCompleted = currentStatus === "SUCCESS" || currentStatus === "DONE" || currentStatus === "COMPLETED" || currentStatus === "FINISHED";

    if (isCompleted && videoUrl) {
      return Response.json({
        status: "DONE",
        url: videoUrl,
        raw: rawData
      });
    }

    // Во всех остальных случаях (PROCESSING, PENDING, IN_PROGRESS, QUEUED) продолжаем опрос
    return Response.json({
      status: "IN_PROGRESS",
      picsart_status: currentStatus,
      raw: rawData
    });

  } catch (err) {
    return Response.json({
      status: "IN_PROGRESS",
      temp_error: err.message
    }, { status: 200 });
  }
}
