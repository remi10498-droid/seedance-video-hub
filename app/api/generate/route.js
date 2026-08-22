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

    // Режим генерации картинок
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

    // Режим генерации видео (без ручных width/height > 1024)
    const quality = formData.get("quality") || formData.get("resolution") || "720p";
    const duration = formData.get("duration") || "10";
    const aspectRatio = formData.get("aspect_ratio") || formData.get("aspectRatio") || "16:9";
    const withAudio = formData.get("with_audio") === "true";
    const hdr = formData.get("hdr") === "true";
    const loop = formData.get("loop") === "true";
    const topazModel = formData.get("topaz_model") || "Proteus";
    
    const startFrame = formData.get("start_frame");
    const endFrame = formData.get("end_frame");
    const videoUrl = formData.get("video_url");
    const audioUrl = formData.get("audio_url");

    const videoBody = new FormData();
    if (prompt) videoBody.append("prompt", prompt.trim());
    videoBody.append("model", model);
    videoBody.append("quality", quality);
    videoBody.append("resolution", quality);
    videoBody.append("duration", String(duration));
    videoBody.append("length", String(duration));
    videoBody.append("aspect_ratio", aspectRatio);
    videoBody.append("aspectRatio", aspectRatio);
    videoBody.append("dimension", aspectRatio);
    videoBody.append("with_audio", String(withAudio));
    videoBody.append("generateAudio", String(withAudio));

    if (hdr) videoBody.append("hdr", "true");
    if (loop) videoBody.append("loop", "true");
    if (model === "topaz-upscale-video") videoBody.append("topaz_model", topazModel);

    if (startFrame) {
      videoBody.append("image_url", startFrame);
      videoBody.append("start_frame", startFrame);
      videoBody.append("imageUrls", startFrame);
    }
    if (endFrame) {
      videoBody.append("last_frame_url", endFrame);
      videoBody.append("end_frame", endFrame);
    }
    if (videoUrl) {
      videoBody.append("video_url", videoUrl);
      videoBody.append("videoUrls", videoUrl);
    }
    if (audioUrl) {
      videoBody.append("audio_url", audioUrl);
      videoBody.append("audioUrl", audioUrl);
    }

    const endpoint = startFrame || model.includes("grok-imagine")
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
      url: data?.url || data?.data?.url || null,
      raw: data,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Ошибка сервера" }, { status: 500 });
  }
}
