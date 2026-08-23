import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing ID" }, { status: 400 });
    }

    const apiKey = process.env.PICSART_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API-ключ не настроен" }, { status: 500 });
    }

    const headers = {
      accept: "application/json",
      "X-Picsart-API-Key": apiKey,
    };

    // Опрашиваем статус
    const res = await fetch(`https://genai-api.picsart.io/v1/video/${id}`, {
      headers,
      cache: "no-store",
    });

    const rawData = await res.json().catch(() => null);

    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json({ status: "IN_PROGRESS" }, { status: 200 });
      }
      return NextResponse.json({ status: "FAILED", error: rawData?.detail || `HTTP ${res.status}` }, { status: 200 });
    }

    const currentStatus = String(rawData?.status || rawData?.state || rawData?.inference_status || "").toUpperCase();

    // Извлекаем URL
    let videoUrl = null;
    if (rawData?.data) {
      if (Array.isArray(rawData.data) && rawData.data[0]) {
        videoUrl = rawData.data[0].url || rawData.data[0].video_url;
      } else if (typeof rawData.data === "object") {
        videoUrl = rawData.data.url || rawData.data.video_url;
      }
    }
    if (!videoUrl && rawData?.url) videoUrl = rawData.url;

    // ИЗВЛЕКАЕМ РЕАЛЬНУЮ МОДЕЛЬ
    const actualModelRaw = rawData?.model || rawData?.pipeline || rawData?.data?.model || "Unknown Model";
    
    // ИЗВЛЕКАЕМ РЕАЛЬНЫЕ СПИСАННЫЕ КРЕДИТЫ
    const actualCredits = rawData?.consumed_credits ?? rawData?.credits_spent ?? rawData?.data?.credits ?? rawData?.usage?.credits ?? null;

    const isCompleted = currentStatus === "SUCCESS" || currentStatus === "DONE" || currentStatus === "COMPLETED";
    const isFailed = currentStatus === "FAILED" || currentStatus === "ERROR" || currentStatus === "REJECTED";

    if (isFailed) {
      return NextResponse.json({ status: "FAILED", error: rawData?.detail || "Генерация отклонена сервером" });
    }

    if (isCompleted && videoUrl) {
      return NextResponse.json({
        status: "DONE",
        url: videoUrl,
        real_model: actualModelRaw,
        real_credits: actualCredits
      });
    }

    return NextResponse.json({ status: "IN_PROGRESS" });
  } catch (err) {
    return NextResponse.json({ status: "IN_PROGRESS" }, { status: 200 });
  }
}
