import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const formData = await req.formData();
    const prompt = formData.get("prompt") || "";
    const password = formData.get("password") || formData.get("key") || "";
    const model = formData.get("model") || "seedance-2.5";

    const validPass = process.env.SITE_PASSWORD || process.env.ACCESS_CODE || "SEED480";
    if (password !== validPass && password !== "SEED" && password !== "SEED480") {
      return NextResponse.json({ error: "Неверный пароль доступа" }, { status: 401 });
    }

    const apiKey = process.env.PICSART_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "PICSART_API_KEY не задан в Vercel" }, { status: 500 });
    }

    if (!prompt.trim() && model !== "topaz-upscale-video" && model !== "ltx-2.3-a2v" && model !== "kling-motion-control-v3") {
      return NextResponse.json({ error: "Введите текст промпта" }, { status: 400 });
    }

    // --- РЕЖИМ ГЕНЕРАЦИИ ВИДЕО (Единственный) ---
    const rawDuration = Number(formData.get("duration") || formData.get("length")) || 5;
    const durationNum = Math.min(rawDuration, 30); 
    
    const aspectRatio = formData.get("aspectRatio") || "16:9";
    const withAudio = formData.get("with_audio") === "true";
    
    const startFrame = formData.get("start_frame");
    const endFrame = formData.get("end_frame");
    const videoUrl = formData.get("video_url");
    const audioUrl = formData.get("audio_url");
    
    let actualModel = model;
    
    // Маппинг на системные URN для Picsart
    const urnMap = {
      "seedance-2.5": "urn:air:seedance:model:seedance:seedance-2.5@1",
      "seedance-2.0": "urn:air:seedance:model:seedance:seedance-2.0@1",
      "flux-3-video": "urn:air:fluxai:model:fluxai:flux-3-preview-high@1",
      "grok-imagine-video-1.5": "urn:air:xai:model:xai:grok-imagine-video-1.5@1",
      "hailuo-03": "urn:air:minimax:model:minimax:hailuo-2.3@1",
      "sora-2-pro": "urn:air:openai:model:sora:sora-2.0@1",
      "sora-2": "urn:air:openai:model:sora:sora-2.0@1",
      "seedance-2.5-video-extend": "urn:air:seedance:model:seedance:seedance-2.5@1",
      "seedance-2.0-video-extend": "urn:air:seedance:model:seedance:seedance-2.0@1",
      "wan-3.0-video": "urn:air:wan:model:wan:wan-2.7@1",
      "luma-ray-3.2": "urn:air:luma:model:luma:ray-3-2@1",
      "kling-motion-control-v3": "kling-motion-control-v3", // Точный ID Kling Motion Control V3
    };
    if (urnMap[model]) actualModel = urnMap[model];

    // Конвертируем соотношение сторон в пиксели (до 1024)
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

    // Привязываем картинки (одиночный кадр или массив)
    if (startFrame) {
      videoBody.append("image_url", startFrame);
      videoBody.append("imageUrls", startFrame); // Для Kling Motion
    }
    if (endFrame) {
      videoBody.append("last_frame_url", endFrame);
    }
    
    // Привязываем исходные видео
    if (videoUrl) {
      videoBody.append("video_url", videoUrl);
      videoBody.append("videoUrls", videoUrl); // Универсально
      videoBody.append("videoUrl", videoUrl); // Для Kling Motion
    }
    
    // Привязываем исходное аудио
    if (audioUrl) {
      videoBody.append("audio_url", audioUrl);
      videoBody.append("audioUrl", audioUrl);
    }

    // Выбираем шлюз генерации (с учетом того, что Kling Motion идет через image2video)
    const endpoint = startFrame || actualModel.includes("grok-imagine") || actualModel.includes("kling-motion")
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
