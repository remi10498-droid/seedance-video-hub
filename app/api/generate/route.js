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

    if (!prompt.trim() && model !== "topaz-upscale-video" && model !== "ltx-2.3-a2v") {
      return NextResponse.json({ error: "Введите текст промпта" }, { status: 400 });
    }

    // --- 1. РЕЖИМ ГЕНЕРАЦИИ ИЗОБРАЖЕНИЙ ---
    if (mode === "image" || model.includes("flux-2-pro") || model.includes("seedream") || model.includes("grok-imagine-image")) {
      const size = formData.get("resolution") || "1024x1024";
      const [w, h] = size.includes("x") ? size.split("x") : (size === "2k" ? ["2048", "2048"] : ["1024", "1024"]);

      const imgBody = new FormData();
      imgBody.append("prompt", prompt.trim());
      imgBody.append("width", w);
      imgBody.append("height", h);
      imgBody.append("model", model);
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

      const imgUrl = data?.data?.[0]?.url || data?.url || (Array.isArray(data?.data) ? data?.data[0] : null);
      return NextResponse.json({ success: true, mode: "image", url: imgUrl, inference_id: data?.inference_id || data?.id });
    }

    // --- 2. РЕЖИМ ГЕНЕРАЦИИ ВИДЕО ---
    const rawDuration = Number(formData.get("duration") || formData.get("length")) || 5;
    // Ограничиваем длину 20 секундами, как указано в OpenAPI[cite: 6]
    const durationNum = Math.min(rawDuration, 20); 
    
    const aspectRatio = formData.get("aspect_ratio") || formData.get("aspectRatio") || "16:9";
    const withAudio = formData.get("with_audio") === "true" || formData.get("generateAudio") === "true";
    
    const startFrame = formData.get("start_frame") || formData.get("startFrame");
    
    // Маппинг правильных URN из спецификации OpenAPI[cite: 6]
    let actualModel = model;
    const urnMap = {
      "seedance-2.5": "urn:air:seedance:model:seedance:seedance-2.5@1",
      "seedance-2.0": "urn:air:seedance:model:seedance:seedance-2.0@1",
      "flux-3-video": "urn:air:fluxai:model:fluxai:flux-3-preview-high@1",
      "kling-v3-pro": "urn:air:kling:model:kling:kling-v3@1",
      "wan-3.0-video": "urn:air:wan:model:wan:wan-2.7@1",
      "luma-ray-3.2": "urn:air:luma:model:luma:ray-3-2@1",
      "grok-imagine-video-1.5": "urn:air:xai:model:xai:grok-imagine-video@1",
      "hailuo-03": "urn:air:minimax:model:minimax:hailuo-2.3@1"
    };
    
    if (urnMap[model]) {
      actualModel = urnMap[model];
    }

    // Рассчет точных width и height (max 1024)[cite: 6]
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
    
    // Передаем строго официальные ключи[cite: 6]
    videoBody.append("width", String(width));
    videoBody.append("height", String(height));
    videoBody.append("length", String(durationNum));
    videoBody.append("audio", String(withAudio));
    
    if (startFrame) {
      videoBody.append("image_url", startFrame);
    }

    // Выбор шлюза
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
