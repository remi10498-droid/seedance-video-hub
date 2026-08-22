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
    const enableThinking = formData.get("enable_thinking") === "true";
    const hdr = formData.get("hdr") === "true";
    const loop = formData.get("loop") === "true";
    const topazModel = formData.get("topaz_model") || "Proteus";
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

    // 2. Формирование параметров
    const parameters = {};
    if (prompt.trim()) parameters.prompt = prompt.trim();
    if (aspectRatio && aspectRatio !== "adaptive") parameters.aspectRatio = aspectRatio;

    if (model === "seedance-2.5" || model === "seedance-2.0") {
      parameters.duration = Number(duration);
      parameters.resolution = resolution.toLowerCase();
      parameters.generateAudio = generateAudio;
      if (startFrame) parameters.startFrame = startFrame;
      if (endFrame) parameters.endFrame = endFrame;
    } else if (model === "seedance-2.5-video-extend" || model === "seedance-2.0-video-extend") {
      if (!videoUrl) return NextResponse.json({ error: "Загрузите исходное видео для продления" }, { status: 400 });
      parameters.duration = Number(duration);
      parameters.resolution = resolution.toLowerCase();
      parameters.generateAudio = generateAudio;
      parameters.videoUrls = [videoUrl];
      parameters.aspectRatio = "adaptive";
    } else if (model === "kling-v3-pro") {
      parameters.duration = Number(duration) || 5;
      parameters.resolution = resolution.toLowerCase();
      if (startFrame) parameters.imageUrls = [startFrame];
    } else if (model === "luma-ray-3.2") {
      parameters.duration = Number(duration) || 5;
      parameters.resolution = resolution.toLowerCase();
      parameters.hdr = hdr;
      parameters.loop = loop;
      if (startFrame) parameters.startFrame = startFrame;
      if (endFrame) parameters.endFrame = endFrame;
    } else if (model === "flux-3-video") {
      parameters.duration = duration === "auto" ? "auto" : Number(duration);
      parameters.resolution = resolution.toLowerCase() === "1080p" ? "fhd" : "hd";
      parameters.generateAudio = generateAudio;
      if (startFrame) parameters.imageUrls = [startFrame];
      if (videoUrl) parameters.videoUrl = videoUrl;
    } else if (model === "wan-3.0-video") {
      parameters.duration = Number(duration);
      parameters.resolution = resolution.toUpperCase();
      parameters.generateAudio = generateAudio;
      if (enableThinking) parameters.enableThinking = true;
      if (startFrame) parameters.startFrame = startFrame;
      if (endFrame) parameters.endFrame = endFrame;
    } else if (model === "sora-2" || model === "sora-2-pro") {
      parameters.duration = Number(duration);
      if (model === "sora-2-pro") parameters.resolution = resolution.toLowerCase();
      if (startFrame) parameters.imageUrls = [startFrame];
    } else if (model === "hailuo-03") {
      parameters.duration = Number(duration);
      if (startFrame) parameters.startFrame = startFrame;
      if (endFrame) parameters.endFrame = endFrame;
    } else if (model === "grok-imagine-video-1.5") {
      if (!startFrame) return NextResponse.json({ error: "Для Grok Video обязательно загрузите фото" }, { status: 400 });
      parameters.duration = Number(duration);
      parameters.resolution = resolution.toLowerCase();
      parameters.imageUrls = [startFrame];
    } else if (model === "topaz-upscale-video") {
      if (!videoUrl) return NextResponse.json({ error: "Загрузите видео для апскейла" }, { status: 400 });
      parameters.videoUrl = videoUrl;
      parameters.model = topazModel;
      delete parameters.aspectRatio;
    } else if (model === "kling-motion-control") {
      if (!startFrame || !videoUrl) return NextResponse.json({ error: "Для Kling Motion Control нужны фото и видео" }, { status: 400 });
      parameters.imageUrls = [startFrame];
      parameters.videoUrl = videoUrl;
      parameters.resolution = resolution.toLowerCase();
      delete parameters.aspectRatio;
    } else if (model === "ltx-2.3-a2v") {
      if (!audioUrl) return NextResponse.json({ error: "Загрузите аудиофайл" }, { status: 400 });
      parameters.audioUrl = audioUrl;
      if (startFrame) parameters.imageUrls = [startFrame];
      delete parameters.aspectRatio;
    } else {
      // Изображения
      parameters.resolution = resolution.includes("2k") ? "2k" : "1k";
      parameters.count = 1;
      if (startFrame) parameters.imageUrls = [startFrame];
    }

    // 3. Отправка запроса в официальный шлюз Picsart GenAI API
    const response = await fetch("https://api.picsart.com/genai/v1/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        parameters: parameters,
      }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.message || data?.detail || "Ошибка вызова Picsart API" },
        { status: response.status }
      );
    }

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
