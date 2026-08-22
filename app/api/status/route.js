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

    const res = await fetch(`https://genai-api.picsart.io/v1/video/${id}`, {
      headers,
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
          error: rawData?.detail || rawData?.message || `HTTP ${res.status}`,
          raw: rawData,
        },
        { status: 200 }
      );
    }

    const currentStatus = String(
      rawData?.status || rawData?.state || rawData?.inference_status || ""
    ).toUpperCase();

    let videoUrl = null;
    if (rawData?.data) {
      if (Array.isArray(rawData.data) && rawData.data[0]) {
        videoUrl =
          rawData.data[0].url ||
          rawData.data[0].video_url ||
          rawData.data[0].download_url ||
          (typeof rawData.data[0] === "string" ? rawData.data[0] : null);
      } else if (typeof rawData.data === "object") {
        videoUrl =
          rawData.data.url ||
          rawData.data.video_url ||
          rawData.data.download_url ||
          rawData.data.result;
      }
    }
    if (!videoUrl && rawData?.result) {
      videoUrl = Array.isArray(rawData.result)
        ? rawData.result[0]?.url || rawData.result[0]
        : rawData.result?.url || rawData.result;
    }
    if (!videoUrl && rawData?.url) {
      videoUrl = rawData.url;
    }

    // Извлечение реальной модели и фактических списанных кредитов
    const actualModelRaw =
      rawData?.model ||
      rawData?.pipeline ||
      rawData?.data?.model ||
      rawData?.raw?.model ||
      "Seedance 2.5";

    let cleanModelName = actualModelRaw;
    if (actualModelRaw.includes("seedance-2.5") || actualModelRaw.includes("seedance:seedance-2.5")) {
      cleanModelName = "Seedance 2.5";
    } else if (actualModelRaw.includes("seedance-2.0")) {
      cleanModelName = "Seedance 2.0";
    } else if (actualModelRaw.includes("kling")) {
      cleanModelName = "Kling Pro";
    } else if (actualModelRaw.includes("wan")) {
      cleanModelName = "Wan 2.7";
    } else if (actualModelRaw.includes("flux")) {
      cleanModelName = "Flux 3 Video";
    }

    const actualCredits =
      rawData?.consumed_credits ??
      rawData?.credits_spent ??
      rawData?.data?.credits ??
      rawData?.usage?.credits ??
      null;

    const isCompleted =
      currentStatus === "SUCCESS" ||
      currentStatus === "DONE" ||
      currentStatus === "COMPLETED" ||
      currentStatus === "FINISHED";

    const isFailed =
      currentStatus === "FAILED" ||
      currentStatus === "ERROR" ||
      currentStatus === "REJECTED";

    if (isFailed) {
      return NextResponse.json({
        status: "FAILED",
        error: rawData?.detail || rawData?.message || "Генерация отклонена сервером",
      });
    }

    if (isCompleted && videoUrl) {
      return NextResponse.json({
        status: "DONE",
        url: videoUrl,
        real_model: cleanModelName,
        real_credits: actualCredits,
        raw: rawData,
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
