import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const fallbackModel = searchParams.get("model_name") || "Seedance 2.5";

    if (!id) {
      return NextResponse.json({ error: "Missing ID" }, { status: 400 });
    }

    const apiKey = process.env.PICSART_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API-ключ не настроен" }, { status: 500 });
    }

    // Запрос статуса через официальный шлюз
    const res = await fetch(`https://api.picsart.com/genai/v1/status/${id}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    });

    const rawData = await res.json().catch(() => null);

    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json({ status: "IN_PROGRESS" }, { status: 200 });
      }
      return NextResponse.json(
        {
          status: "FAILED",
          error: rawData?.message || rawData?.detail || `HTTP ${res.status}`,
        },
        { status: 200 }
      );
    }

    const currentStatus = String(
      rawData?.status || rawData?.state || rawData?.inference_status || ""
    ).toUpperCase();

    // Извлечение прямой ссылки на файл
    let mediaUrl = null;
    if (rawData?.results && Array.isArray(rawData.results) && rawData.results[0]) {
      mediaUrl = rawData.results[0].url || rawData.results[0];
    } else if (rawData?.data) {
      if (Array.isArray(rawData.data) && rawData.data[0]) {
        mediaUrl = rawData.data[0].url || (typeof rawData.data[0] === "string" ? rawData.data[0] : null);
      } else if (typeof rawData.data === "object") {
        mediaUrl = rawData.data.url;
      }
    } else if (rawData?.url) {
      mediaUrl = rawData.url;
    }

    // Извлечение названия модели
    const rawModel = String(
      rawData?.model || rawData?.pipeline || fallbackModel
    );

    let cleanModelName = fallbackModel;
    if (rawModel.includes("seedance-2.5")) cleanModelName = "Seedance 2.5";
    else if (rawModel.includes("seedance-2.0")) cleanModelName = "Seedance 2.0";
    else if (rawModel.includes("flux-3")) cleanModelName = "Flux 3 Video";
    else if (rawModel.includes("wan")) cleanModelName = "Wan 3.0 Video";
    else if (rawModel.includes("sora-2-pro")) cleanModelName = "Sora 2 Pro";
    else if (rawModel.includes("sora-2")) cleanModelName = "Sora 2";
    else if (rawModel.includes("kling")) cleanModelName = "Kling Omni";
    else if (rawModel.includes("hailuo")) cleanModelName = "Hailuo 03";
    else if (rawModel.includes("grok-imagine-video")) cleanModelName = "Grok Video 1.5";

    // Извлечение расхода кредитов
    const actualCredits =
      rawData?.consumed_credits ??
      rawData?.credits_spent ??
      rawData?.usage?.credits ??
      null;

    const isCompleted =
      currentStatus === "SUCCESS" ||
      currentStatus === "DONE" ||
      currentStatus === "COMPLETED";

    const isFailed =
      currentStatus === "FAILED" ||
      currentStatus === "ERROR" ||
      currentStatus === "REJECTED";

    if (isFailed) {
      return NextResponse.json({
        status: "FAILED",
        error: rawData?.message || rawData?.detail || "Генерация отклонена сервером",
      });
    }

    if (isCompleted && mediaUrl) {
      return NextResponse.json({
        status: "DONE",
        url: mediaUrl,
        real_model: cleanModelName,
        real_credits: actualCredits,
      });
    }

    return NextResponse.json({
      status: "IN_PROGRESS",
      picsart_status: currentStatus,
    });
  } catch (err) {
    return NextResponse.json({ status: "IN_PROGRESS", temp_error: err.message }, { status: 200 });
  }
}
