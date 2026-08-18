export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json({ error: "Missing ID" }, { status: 400 });
    }

    const res = await fetch(`https://genai-api.picsart.io/v1/video/${id}`, {
      headers: {
        "accept": "application/json",
        "X-Picsart-API-Key": process.env.PICSART_API_KEY
      }
    });

    const raw = await res.json().catch(() => null);

    if (!res.ok) {
      return Response.json({
        status: "FAILED",
        error: raw?.detail || raw?.message || `HTTP ${res.status}`
      });
    }

    // Ищем URL во всех возможных ветках ответа Picsart
    let videoUrl = null;
    if (raw?.data && Array.isArray(raw.data) && raw.data[0]?.url) {
      videoUrl = raw.data[0].url;
    } else if (raw?.data?.url) {
      videoUrl = raw.data.url;
    } else if (raw?.url) {
      videoUrl = raw.url;
    } else if (raw?.result && Array.isArray(raw.result) && raw.result[0]?.url) {
      videoUrl = raw.result[0].url;
    }

    const currentStatus = String(raw?.status || raw?.state || "").toUpperCase();

    // Если есть готовая ссылка и статус DONE / SUCCESS
    if ((currentStatus === "DONE" || currentStatus === "SUCCESS" || currentStatus === "COMPLETED") && videoUrl) {
      return Response.json({
        status: "DONE",
        url: videoUrl
      });
    }

    if (currentStatus === "FAILED" || currentStatus === "ERROR") {
      return Response.json({
        status: "FAILED",
        error: raw?.message || "Ошибка генерации на стороне Picsart"
      });
    }

    // Во всех остальных случаях рендеринг еще идет
    return Response.json({
      status: "IN_PROGRESS"
    });

  } catch (err) {
    return Response.json({ status: "FAILED", error: err.message });
  }
}
