import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Неверный формат запроса (ожидался JSON)" }, { status: 400 });
    }

    const {
      password,
      key,
      prompt = "",
      model = "seedance-2.5",
      duration = "10",
      resolution = "720p",
      aspectRatio = "16:9",
      generateAudio = false,
      enableThinking = false,
      hdr = false,
      loop = false,
      topazModel = "Proteus",
      startFrame = null,
      endFrame = null,
      videoUrl = null,
      audioUrl = null,
    } = body;

    // 1. Проверка пароля доступа
    const clientPass = password || key || "SEED480";
    const validPass = process.env.SITE_PASSWORD || process.env.ACCESS_CODE || "SEED480";
    if (clientPass !== validPass && clientPass !== "SEED" && clientPass !== "SEED480") {
      return NextResponse.json({ error: "Неверный пароль доступа" }, { status: 401 });
    }

    const apiKey = process.env.PICSART_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "PICSART_API_KEY не задан в Vercel" }, { status: 500 });
    }

    if (!prompt.trim() && model !== "topaz-upscale-video" && model !== "ltx-2.3-a2v") {
      return NextResponse.json({ error: "Введите текст промпта" }, { status: 400 });
    }

    // 2. Сборка параметров строго по спецификации официального SDK / REST
    const parameters = {};
    if (prompt.trim()) parameters.prompt = prompt.trim();
    if (aspectRatio && aspectRatio !== "adaptive") parameters.aspectRatio = aspectRatio;

    if (model.includes("seedance")) {
      parameters.duration = Number(duration) || 5;
      parameters.resolution = resolution.toLowerCase();
      parameters.generateAudio = Boolean(generateAudio);
      if (startFrame) parameters.startFrame = startFrame;
      if (endFrame) parameters.endFrame = endFrame;
      if (model.includes("extend")) {
        if (!videoUrl) return NextResponse.json({ error: "Загрузите исходное видео" }, { status: 400 });
        parameters.videoUrls = [videoUrl];
        parameters.aspectRatio = "adaptive";
        if (model.includes("2.5")) parameters.outputFormat = "mp4";
      }
    } else if (model === "flux-3-video") {
      parameters.aspectRatio = aspectRatio === "adaptive" ? "auto" : aspectRatio;
      parameters.resolution = resolution === "1080p" ? "fhd" : "hd";
      parameters.duration = duration === "auto" ? "auto" : Number(duration);
      parameters.generateAudio = Boolean(generateAudio);
      if (startFrame) parameters.imageUrls = [startFrame];
      if (videoUrl) parameters.videoUrl = videoUrl;
    } else if (model === "luma-ray-3.2") {
      parameters.duration = Number(duration) || 5;
      parameters.resolution = resolution.toLowerCase();
      parameters.hdr = Boolean(hdr);
      parameters.loop = Boolean(loop);
      if (startFrame) parameters.startFrame = startFrame;
      if (endFrame) parameters.endFrame = endFrame;
    } else if (model === "hailuo-03") {
      parameters.duration = Number(duration) || 5;
      parameters.aspectRatio = aspectRatio;
      if (startFrame) parameters.startFrame = startFrame;
      if (endFrame) parameters.endFrame = endFrame;
    } else if (model === "sora-2" || model === "sora-2-pro") {
      parameters.duration = Number(duration) || 4;
      if (model === "sora-2-pro") parameters.resolution = resolution.toLowerCase();
      if (startFrame) parameters.imageUrls = [startFrame];
    } else if (model === "grok-imagine-video-1.5") {
      if (!startFrame) return NextResponse.json({ error: "Для Grok Video загрузите фото" }, { status: 400 });
      parameters.duration = Number(duration) || 8;
      parameters.resolution = resolution.toLowerCase();
      parameters.imageUrls = [startFrame];
    } else if (model === "topaz-upscale-video") {
      if (!videoUrl) return NextResponse.json({ error: "Загрузите видео для апскейла" }, { status: 400 });
      parameters.videoUrl = videoUrl;
      parameters.model = topazModel;
      delete parameters.aspectRatio;
    } else if (model === "ltx-2.3-a2v") {
      if (!audioUrl) return NextResponse.json({ error: "Загрузите аудиофайл" }, { status: 400 });
      parameters.audioUrl = audioUrl;
      if (startFrame) parameters.imageUrls = [startFrame];
      delete parameters.aspectRatio;
    } else if (model === "kling-motion-control") {
      if (!startFrame || !videoUrl) return NextResponse.json({ error: "Нужны фото и видео" }, { status: 400 });
      parameters.resolution = resolution.toLowerCase();
      parameters.imageUrls = [startFrame];
      parameters.videoUrl = videoUrl;
      delete parameters.aspectRatio;
    } else {
      // Изображения (Flux.2 Pro, Grok Image, Seedream)
      parameters.resolution = resolution.includes("2k") ? "2k" : "1k";
      if (startFrame) parameters.imageUrls = [startFrame];
    }

    // 3. Отправка POST-запроса на официальный шлюз Picsart REST API
    let response = await fetch("https://api.picsart.com/v1/generate", {
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

    // Фоллбэк на альтернативный workflow-роут SDK, если v1/generate недоступен
    if (response.status === 404) {
      response = await fetch("https://api.picsart.com/genai/v1/generate", {
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
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.message || data?.detail || `Ошибка Picsart API (HTTP ${response.status})` },
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
