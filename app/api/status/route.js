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

    const headers = {
      accept: "application/json",
      "X-Picsart-API-Key": apiKey,
    };

    let rawData = null;
    let res = await fetch(`https://genai-api.picsart.io/v1/inferences?inference_id=${id}`, { headers, cache: "no-store" });
    if (res.ok) rawData = await res.json();

    if (!rawData) {
      res = await fetch(`https://genai-api.picsart.io/v1/text2video/inferences/${id}`, { headers, cache: "no-store" });
      if (res.ok) rawData = await res.json();
    }

    if (!rawData) {
      res = await fetch(`https://genai-api.picsart.io/v1/video/${id}`, { headers, cache: "no-store" });
      if (res.ok) rawData = await res.json();
    }

    if (!rawData) {
      return NextResponse.json({ status: "IN_PROGRESS" }, { status: 200 });
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

    const returnedModel = String(
      rawData?.model || rawData?.data?.model || rawData?.pipeline || fallbackModel
    );

    let cleanModelName = fallbackModel;
    if (returnedModel.includes("seedance-2.5-video-extend")) cleanModelName = "Seedance 2.5 Extend";
    else if (returnedModel.includes("seedance-2.0-video-extend")) cleanModelName = "Seedance 2.0 Extend";
    else if (returnedModel.includes("seedance-2.5")) cleanModelName = "Seedance 2.5";
    else if (returnedModel.includes("seedance-2.0")) cleanModelName = "Seedance 2.0";
    else if (returnedModel.includes("flux-3")) cleanModelName = "Flux 3 Video";
    else if (returnedModel.includes("kling")) cleanModelName = "Kling 3.0 Omni / Pro";
    else if (returnedModel.includes("luma")) cleanModelName = "Luma Ray 3.2";
    else if (returnedModel.includes("wan")) cleanModelName = "Wan 3.0 Video";
    else if (returnedModel.includes("sora-2-pro")) cleanModelName = "Sora 2 Pro";
    else if (returnedModel.includes("sora-2")) cleanModelName = "Sora 2";
    else if (returnedModel.includes("hailuo")) cleanModelName = "Hailuo 03";
    else if (returnedModel.includes("grok")) cleanModelName = "Grok Video 1.5";

    const actualCredits =
      rawData?.consumed_credits ??
      rawData?.credits_spent ??
      rawData?.usage?.credits ??
      rawData?.data?.credits ??
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
