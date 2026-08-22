import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Неверный формат JSON" }, { status: 400 });
    }

    const {
      key = "SEED480",
      prompt,
      model = "seedance-2.5",
      duration = 5,
      resolution = "720p",
      aspectRatio = "16:9",
      generateAudio = true,
      enableThinking = false,
      startFrame = null,
      endFrame = null,
      count = 1,
      quality = "medium",
    } = body;

    // 1. Проверка кода доступа
    const validPass = process.env.SITE_PASSWORD || process.env.ACCESS_CODE || "SEED480";
    if (key !== validPass && key !== "SEED" && key !== "SEED480") {
      return NextResponse.json({ error: "Неверный код доступа" }, { status: 401 });
    }

    // 2. Проверка ключа Picsart
    const apiKey = process.env.PICSART_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "PICSART_API_KEY не задан в Vercel" }, { status: 500 });
    }

    if (!prompt || !prompt.trim()) {
      return NextResponse.json({ error: "Пожалуйста, введите текст промпта" }, { status: 400 });
    }

    // 3. Базовый объект параметров по спецификации Picsart (camelCase)
    const parameters = {
      prompt: prompt.trim(),
      aspectRatio: aspectRatio,
    };

    // 4. Тонкая настройка под каждую модель
    if (model === "seedance-2.5" || model === "seedance-2.0") {
      parameters.duration = Number(duration);
      parameters.resolution = resolution.toLowerCase(); // 480p, 720p, 1080p
      parameters.generateAudio = Boolean(generateAudio);
      if (startFrame) parameters.startFrame = startFrame;
      if (endFrame) parameters.endFrame = endFrame;
    } else if (model === "wan-3.0-video") {
      parameters.duration = Number(duration);
      parameters.resolution = resolution.toUpperCase(); // строго 480P, 720P, 1080P
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
    } else if (model === "flux-2-pro" || model === "grok-imagine-image-2.0") {
      parameters.resolution = resolution.includes("2k") ? "2k" : "1k";
      parameters.quality = quality;
      parameters.count = Number(count) || 1;
      if (startFrame) parameters.imageUrls = [startFrame];
    }

    // 5. Отправка в официальный шлюз Picsart GenAI
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
