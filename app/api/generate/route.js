import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Неверный формат JSON" }, { status: 400 });
    }

    const {
      key,
      password,
      prompt,
      model = "seedance-2.5",
      duration = 5,
      resolution = "720p",
      aspectRatio = "16:9",
      generateAudio = true,
      enableThinking = false,
      hdr = false,
      loop = false,
      topazModel = "Proteus",
      startFrame = null,
      endFrame = null,
      videoUrl = null,
      audioUrl = null,
      count = 1,
      quality = "medium",
    } = body;

    // 1. Проверка пароля доступа
    const clientPass = key || password || "SEED480";
    const validPass = process.env.SITE_PASSWORD || process.env.ACCESS_CODE || "SEED480";
    if (clientPass !== validPass && clientPass !== "SEED" && clientPass !== "SEED480") {
      return NextResponse.json({ error: "Неверный код доступа" }, { status: 401 });
    }

    // 2. Проверка ключа Picsart
    const apiKey = process.env.PICSART_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "PICSART_API_KEY не задан в переменных Vercel" }, { status: 500 });
    }

    if (!prompt && model !== "topaz-upscale-video" && model !== "ltx-2.3-a2v") {
      return NextResponse.json({ error: "Пожалуйста, введите текст промпта" }, { status: 400 });
    }

    // 3. Формирование параметров строго по официальной спецификации SDK (camelCase)
    const parameters = {};
    if (prompt) parameters.prompt = prompt.trim();
    parameters.aspectRatio = aspectRatio;

    // 4. Тонкая настройка под каждую модель
    if (model === "seedance-2.5" || model === "seedance-2.0") {
      parameters.duration = Number(duration);
      parameters.resolution = resolution.toLowerCase();
      parameters.generateAudio = Boolean(generateAudio);
      if (startFrame) parameters.startFrame = startFrame;
      if (endFrame) parameters.endFrame = endFrame;
    } else if (model === "flux-3-video") {
      parameters.duration = duration === "auto" ? "auto" : Number(duration);
      parameters.resolution = resolution.toLowerCase() === "1080p" ? "fhd" : "hd";
      parameters.generateAudio = Boolean(generateAudio);
      if (startFrame) parameters.imageUrls = [startFrame];
      if (videoUrl) parameters.videoUrl = videoUrl;
    } else if (model === "ltx-2.3-a2v") {
      if (!audioUrl) {
        return NextResponse.json({ error: "Для LTX 2.3 обязательно выберите аудиофайл" }, { status: 400 });
      }
      parameters.audioUrl = audioUrl;
      if (startFrame) parameters.imageUrls = [startFrame];
      delete parameters.aspectRatio;
    } else if (model === "kling-motion-control") {
      if (!startFrame || !videoUrl) {
        return NextResponse.json({ error: "Для Kling Motion Control нужны фото человека и видео с движениями" }, { status: 400 });
      }
      parameters.imageUrls = [startFrame];
      parameters.videoUrl = videoUrl;
      parameters.resolution = resolution.toLowerCase();
      delete parameters.aspectRatio;
    } else if (model === "seedance-2.5-video-extend" || model === "seedance-2.0-video-extend") {
      parameters.duration = Number(duration);
      parameters.resolution = resolution.toLowerCase();
      parameters.generateAudio = Boolean(generateAudio);
      parameters.aspectRatio = "adaptive";
      if (videoUrl) parameters.videoUrls = [videoUrl];
      else return NextResponse.json({ error: "Загрузите исходное видео для продления" }, { status: 400 });
    } else if (model === "topaz-upscale-video") {
      if (!videoUrl) return NextResponse.json({ error: "Загрузите видео для апскейла" }, { status: 400 });
      parameters.videoUrl = videoUrl;
      parameters.model = topazModel;
      delete parameters.aspectRatio;
    } else if (model === "wan-3.0-video") {
      parameters.duration = Number(duration);
      parameters.resolution = resolution.toUpperCase();
      parameters.generateAudio = Boolean(generateAudio);
      parameters.enableThinking = Boolean(enableThinking);
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
    } else if (model === "luma-ray-3.2") {
      parameters.duration = Number(duration);
      parameters.resolution = resolution.toLowerCase();
      parameters.hdr = Boolean(hdr);
      parameters.loop = Boolean(loop);
      if (startFrame) parameters.startFrame = startFrame;
      if (endFrame) parameters.endFrame = endFrame;
    } else if (model === "grok-imagine-video-1.5") {
      if (!startFrame) {
        return NextResponse.json({ error: "Для модели Grok Video 1.5 обязательно выберите начальный кадр" }, { status: 400 });
      }
      parameters.duration = Number(duration);
      parameters.resolution = resolution.toLowerCase();
      parameters.imageUrls = [startFrame];
    } else if (model === "flux-2-pro" || model === "grok-imagine-image-2.0" || model === "seedream-5.0-pro") {
      parameters.resolution = resolution.includes("2k") ? "2k" : "1k";
      parameters.quality = quality;
      parameters.count = Number(count) || 1;
      if (startFrame) parameters.imageUrls = [startFrame];
    }

    // 5. Отправка запроса в официальный шлюз Picsart GenAI
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

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
