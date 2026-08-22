import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const formData = await req.formData();
    const prompt = formData.get("prompt");
    const password = formData.get("password") || formData.get("key");
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

    if (!prompt) {
      return NextResponse.json({ error: "Введите текст промпта" }, { status: 400 });
    }

    // Режим картинок
    if (mode === "image" || model.includes("flux-2-pro")) {
      const size = formData.get("resolution") || "1024x1024";
      const [w, h] = size.includes("x") ? size.split("x") : ["1024", "1024"];

      const imgBody = new FormData();
      imgBody.append("prompt", prompt.trim());
      imgBody.append("width", w);
      imgBody.append("height", h);
      imgBody.append("model", "flux-pro");
      imgBody.append("count", "1");

      const res = await fetch("https://genai-api.picsart.io/v1/text2image", {
        method: "POST",
        headers: {
          accept: "application/json",
          "X-Picsart-API-Key": apiKey,
        },
        body: imgBody,
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return NextResponse.json({ error: data?.detail || data?.message || "Ошибка генерации картинки" }, { status: res.status });
      }

      const imgUrl = data?.data?.[0]?.url || data?.url;
      return NextResponse.json({ success: true, mode: "image", url: imgUrl, inference_id: data?.inference_id || data?.id });
    }

    // Режим видео
    const rawDuration = Number(formData.get("duration") || formData.get("length")) || 5;
    const durationNum = rawDuration > 20 ? 20 : rawDuration; // Максимум API Picsart
    const quality = formData.get("quality") || formData.get("resolution") || "720p";
    const aspectRatio = formData.get("aspect_ratio") || formData.get("aspectRatio") || "16:9";
    const withAudio = formData.get("with_audio") === "true";
    const startFrame = formData.get("start_frame");
    const endFrame = formData.get("end_frame");

    // URN маппинг для точного запуска нейросетей
    let actualModel = model;
    if (model === "seedance-2.5") actualModel = "urn:air:seedance:model:seedance:seedance-2.5@1";
    else if (model === "kling-v3-pro") actualModel = "urn:air:kling:model:kling:kling-v1.5-pro@1";
    else if (model === "flux-3-video") actualModel = "urn:air:black-forest-labs:model:flux:flux-3-video@1";

    const videoBody = new FormData();
    videoBody.append("prompt", prompt.trim());
    videoBody.append("model", actualModel);
    videoBody.append("quality", quality);
    videoBody.append("length", String(durationNum));
    videoBody.append("duration", String(durationNum));
    videoBody.append("duration_seconds", String(durationNum));
    videoBody.append("seconds", String(durationNum));
    videoBody.append("aspect_ratio", aspectRatio);
    videoBody.append("ratio", aspectRatio);

    if (withAudio) videoBody.append("with_audio", "true");
    if (startFrame) videoBody.append("image_url", startFrame);
    if (endFrame) videoBody.append("last_frame_url", endFrame);

    const endpoint = startFrame
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
      return NextResponse.json({ error: data?.detail || data?.message || "Ошибка Picsart Video API" }, { status: res.status });
    }

    const inferenceId = data?.inference_id || data?.id || data?.data?.id;

    return NextResponse.json({
      success: true,
      mode: "video",
      inference_id: inferenceId,
      raw: data,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Ошибка сервера" }, { status: 500 });
  }
}
