import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const fallbackModel = searchParams.get("model_name") || "Неизвестная модель";

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

    const res = await fetch(`https://genai-api.picsart.io/v1/video/${id}`, {
      headers,
      cache: "no-store",
    });

    const rawData = await res.json().catch(() => null);

    if (!res.ok) {
      if (res.status === 404) return NextResponse.json({ status: "IN_PROGRESS" }, { status: 200 });
      return NextResponse.json({ status: "FAILED", error: rawData?.detail || `HTTP ${res.status}` }, { status: 200 });
    }

    const currentStatus = String(rawData?.status || rawData?.state || rawData?.inference_status || "").toUpperCase();

    let videoUrl = null;
    if (rawData?.data) {
      if (Array.isArray(rawData.data) && rawData.data[0]) {
        videoUrl = rawData.data[0].url || rawData.data[0].video_url;
      } else if (typeof rawData.data === "object") {
        videoUrl = rawData.data.url || rawData.data.video_url;
      }
    }
    if (!videoUrl && rawData?.url) videoUrl = rawData.url;
    if (!videoUrl && rawData?.result?.url) videoUrl = rawData.result.url;

    // ИЗВЛЕКАЕМ И ПАРСИМ РЕАЛЬНУЮ МОДЕЛЬ
    const actualModelRaw = String(rawData?.model || rawData?.pipeline || rawData?.data?.model || fallbackModel);
    let cleanModelName = actualModelRaw;

    if (actualModelRaw.includes("seedance-2.5")) cleanModelName = "Seedance 2.5";
    else if (actualModelRaw.includes("seedance-2.0")) cleanModelName = "Seedance 2.0";
    else if (actualModelRaw.includes("kling")) cleanModelName = "Kling 3.0";
    else if (actualModelRaw.includes("luma")) cleanModelName = "Luma Ray 3.2";
    else if (actualModelRaw.includes("wan")) cleanModelName = "Wan 3.0";
    else if (actualModelRaw.includes("grok")) cleanModelName = "Grok 1.5";
    else if (actualModelRaw.includes("flux")) cleanModelName = "Flux 3 Video";
    else if (actualModelRaw.includes("sora-2-pro")) cleanModelName = "Sora 2 Pro";
    else if (actualModelRaw.includes("sora-2")) cleanModelName = "Sora 2";
    else if (actualModelRaw.includes("hailuo")) cleanModelName = "Hailuo 03";
    else if (actualModelRaw.includes("urn:")) cleanModelName = fallbackModel; // Если пришел URN без названия, ставим fallback

    // ИЗВЛЕКАЕМ РЕАЛЬНЫЕ СПИСАННЫЕ КРЕДИТЫ
    const actualCredits = rawData?.consumed_credits ?? rawData?.credits_spent ?? rawData?.data?.credits ?? rawData?.usage?.credits ?? null;

    const isCompleted = currentStatus === "SUCCESS" || currentStatus === "DONE" || currentStatus === "COMPLETED" || currentStatus === "FINISHED";
    const isFailed = currentStatus === "FAILED" || currentStatus === "ERROR" || currentStatus === "REJECTED";

    if (isFailed) {
      return NextResponse.json({ status: "FAILED", error: rawData?.detail || "Генерация отклонена сервером" });
    }

    if (isCompleted && videoUrl) {
      return NextResponse.json({
        status: "DONE",
        url: videoUrl,
        real_model: cleanModelName,
        real_credits: actualCredits
      });
    }

    return NextResponse.json({ status: "IN_PROGRESS" });
  } catch (err) {
    return NextResponse.json({ status: "IN_PROGRESS" }, { status: 200 });
  }
}
