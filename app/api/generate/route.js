import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const formData = await req.formData();
    const prompt = formData.get("prompt") || "";
    const password = formData.get("password") || formData.get("key") || "";
    const model = formData.get("model") || "seedance-2.5";
    const duration = formData.get("duration") || "5";
    const resolution = formData.get("resolution") || "720p";
    const aspectRatio = formData.get("aspect_ratio") || formData.get("aspectRatio") || "16:9";
    const generateAudio = formData.get("with_audio") === "true";
    const hdr = formData.get("hdr") === "true";
    const loop = formData.get("loop") === "true";
    const topazModel = formData.get("topaz_model") || "Proteus";
    
    // Ссылки на медиа
    const startFrame = formData.get("start_frame");
    const endFrame = formData.get("end_frame");
    const videoUrl = formData.get("video_url");
    const audioUrl = formData.get("audio_url");

    // 1. Проверка пароля доступа
    const validPass = process.env.SITE_PASSWORD || process.env.ACCESS_CODE || "SEED480";
    if (password !== validPass && password !== "SEED" && password !== "SEED480") {
      return NextResponse.json({ error: "Неверный пароль доступа" }, { status: 401 });
    }

    const apiKey = process.env.PICSART_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "PICSART_API_KEY не задан в Vercel" }, { status: 500 });
    }

    if (!prompt.trim() && model !== "topaz-upscale-video" && model !== "ltx-2.3-a2v") {
      return NextResponse.json({ error: "Введите текст промпта" }, { status: 400 });
    }

    // 2. Сборка параметров строго по спецификации (camelCase)
    const parameters = {};
    if (prompt.trim()) parameters.prompt = prompt.trim();
    if (aspectRatio && aspectRatio !== "adaptive") parameters.aspectRatio = aspectRatio;

    if (model === "flux-3-video") {
      // Flux 3 Video
      parameters.aspectRatio = aspectRatio === "adaptive" ? "auto" : aspectRatio;
      parameters.resolution = resolution === "1080p" ? "fhd" : "hd";
      parameters.duration = duration === "auto" ? "auto" : Number(duration);
      parameters.generateAudio = generateAudio;
      if (startFrame) parameters.imageUrls = [startFrame];
      if (videoUrl) parameters.videoUrl = videoUrl;
    } else if (model.includes("seedance-2.0") || model.includes("seedance-2.5")) {
      // Seedance 2.0 / 2.5 + Extend
      parameters.aspectRatio = aspectRatio;
      parameters.resolution = resolution;
      parameters.duration = Number(duration);
      parameters.generateAudio = generateAudio;
      if (startFrame) parameters.startFrame = startFrame;
      if (endFrame) parameters.endFrame = endFrame;
      
      if (model.includes("extend")) {
        if (!videoUrl) return NextResponse.json({ error: "Загрузите исходное видео" }, { status: 400 });
        parameters.videoUrls = [videoUrl];
        parameters.aspectRatio = "adaptive";
        if (model.includes("2.5")) parameters.outputFormat = "mp4";
      }
    } else if (model === "ltx-2.3-a2v") {
      // LTX Audio-to-Video
      if (!audioUrl) return NextResponse.json({ error: "Загрузите аудиофайл" }, { status: 400 });
      parameters.audioUrl = audioUrl;
      if (startFrame) parameters.imageUrls = [startFrame];
      delete parameters.aspectRatio;
    } else if (model === "kling-motion-control") {
      // Kling Motion Control
      if (!startFrame || !videoUrl) return NextResponse.json({ error: "Нужны фото и видео" }, { status: 400 });
      parameters.resolution = resolution;
      parameters.imageUrls = [startFrame];
      parameters.videoUrl = videoUrl;
      delete parameters.aspectRatio;
    } else if (model === "sora-2" || model === "sora-2-pro") {
      // OpenAI Sora
      parameters.duration = Number(duration);
      if (model === "sora-2-pro") parameters.resolution = resolution;
      if (startFrame) parameters.imageUrls = [startFrame];
    } else if (model === "hailuo-03") {
      // Hailuo 03
      parameters.duration = Number(duration);
      parameters.aspectRatio = aspectRatio;
      if (startFrame) parameters.startFrame = startFrame;
      if (endFrame) parameters.endFrame = endFrame;
    } else if (model === "luma-ray-3.2") {
      // Luma Ray
      parameters.duration = Number(duration);
      parameters.resolution = resolution;
      parameters.hdr = hdr;
      parameters.loop = loop;
      if (startFrame) parameters.startFrame = startFrame;
      if (endFrame) parameters.endFrame = endFrame;
    } else if (model === "topaz-upscale-video") {
      // Topaz Upscale
      if (!videoUrl) return NextResponse.json({ error: "Загрузите видео" }, { status: 400 });
      parameters.videoUrl = videoUrl;
      parameters.model = topazModel;
      delete parameters.aspectRatio;
    } else if (model === "grok-imagine-video-1.5") {
      // Grok Video
      if (!startFrame) return NextResponse.json({ error: "Загрузите фото для Grok" }, { status: 400 });
      parameters.duration = Number(duration);
      parameters.resolution = resolution;
      parameters.imageUrls = [startFrame];
    } else if (model === "wan-3.0-video" || model === "kling-v3-pro") {
      parameters.duration = Number(duration);
      parameters.resolution = resolution.toUpperCase() === "480P" ? "480p" : resolution;
      if (startFrame) parameters.imageUrls = [startFrame];
    } else {
      // Изображения (Flux.2 Pro, Seedream)
      parameters.resolution = resolution.includes("2k") || resolution.includes("2048") ? "2k" : "1k";
      if (startFrame) parameters.imageUrls = [startFrame];
    }

    // 3. Отправка POST-запроса на официальный JSON-шлюз
    const payload = {
      model: model,
      parameters: parameters,
    };

    const response = await fetch("https://api.picsart.com/genai/v1/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.message || data?.detail || "Ошибка вызова Picsart API" },
        { status: response.status }
      );
    }

    // Возврат ID задачи
    const taskId = data?.id || data?.inference_id || data?.data?.id;
    const directUrl = data?.url || data?.results?.[0]?.url || data?.data?.[0]?.url;

    return NextResponse.json({
      success: true,
      inference_id: taskId,
      url: directUrl || null,
      raw: data,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Ошибка сервера" }, { status: 500 });
  }
}
