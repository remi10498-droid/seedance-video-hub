import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const formData = await req.formData();
    const prompt = formData.get("prompt") || "";
    const password = formData.get("password") || formData.get("key") || "";
    const model = formData.get("model") || "seedance-2.5";
    const mode = formData.get("mode") || "video";

    const validPass = process.env.SITE_PASSWORD || process.env.ACCESS_CODE || "SEED480";
    if (password !== validPass && password !== "SEED" && password !== "SEED480") {
      return NextResponse.json({ error: "Неверный пароль доступа" }, { status: 401 });
    }

    const apiKey = process.env.PICSART_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "PICSART_API_KEY не задан в Vercel" }, { status: 500 });
    }

    const rawDuration = Number(formData.get("duration") || formData.get("length")) || 5;
    const durationNum = Math.min(rawDuration, 30); 
    
    const aspectRatio = formData.get("aspectRatio") || "16:9";
    const withAudio = formData.get("with_audio") === "true";
    
    const startFrame = formData.get("start_frame");
    const endFrame = formData.get("end_frame");
    const videoUrl = formData.get("video_url");
    const audioUrl = formData.get("audio_url");
    
    let actualModel = model;
    const urnMap = {
      "seedance-2.5": "urn:air:seedance:model:seedance:seedance-2.5@1",
      "seedance-2.0": "urn:air:seedance:model:seedance:seedance-2.0@1",
      "flux-3-video": "urn:air:fluxai:model:fluxai:flux-3-preview-high@1",
      "grok-imagine-video-1.5": "urn:air:xai:model:xai:grok-imagine-video-1.5@1",
      "hailuo-03": "urn:air:minimax:model:minimax:hailuo-2.3@1",
      "sora-2-pro": "urn:air:openai:model:sora:sora-2.0@1",
      "seedance-2.5-video-extend": "urn:air:seedance:model:seedance:seedance-2.5@1",
    };
    if (urnMap[model]) actualModel = urnMap[model];

    let width = 1024;
    let height = 576;
    if (aspectRatio === "9:16") { width = 576; height = 1024; }
    else if (aspectRatio === "1:1") { width = 1024; height = 1024; }
    else if (aspectRatio === "4:3") { width = 1024; height = 768; }
    else if (aspectRatio === "3:4") { width = 768; height = 1024; }
    else if (aspectRatio === "21:9") { width = 1024; height = 438; }

    const videoBody = new FormData();
    if (prompt) videoBody.append("prompt", prompt.trim());
    videoBody.append("model", actualModel);
    
    videoBody.append("width", String(width));
    videoBody.append("height", String(height));
    videoBody.append("length", String(durationNum));
    videoBody.append("audio", String(withAudio));

    if (startFrame) videoBody.append("image_url", startFrame);
    if (endFrame) videoBody.append("last_frame_url", endFrame);
    if (videoUrl) {
      videoBody.append("video_url", videoUrl);
      videoBody.append("videoUrls", videoUrl);
    }
    if (audioUrl) {
      videoBody.append("audio_url", audioUrl);
      videoBody.append("audioUrl", audioUrl);
    }

    const endpoint = startFrame || actualModel.includes("grok-imagine")
      ? "https://genai-api.picsart.io/v1/image2video"
      : "https://genai-api.picsart.io/v1/text2video";

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        "X-Picsart-API-Key": apiKey,
      },
      body: videoBody,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json({ error: data?.detail || data?.message || "Ошибка Picsart Video API", raw: data }, { status: res.status });
    }

    const inferenceId = data?.inference_id || data?.id || data?.data?.id;

    return NextResponse.json({
      success: true,
      mode: "video",
      inference_id: inferenceId,
      url: data?.url || data?.data?.url || null,
      raw: data,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Ошибка сервера" }, { status: 500 });
  }
}
