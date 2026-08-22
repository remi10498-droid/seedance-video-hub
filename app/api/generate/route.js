import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Официальная карта воркфлоу из документации Picsart
const WORKFLOW_MAP = {
  "seedance-2.5": "seedance",
  "seedance-2.0": "seedance",
  "seedance-2.5-video-extend": "seedance",
  "seedance-2.0-video-extend": "seedance",
  "luma-ray-3.2": "luma-ray32-video",
  "hailuo-03": "minimax/v2/video-generation",
  "grok-imagine-video-1.5": "x-ai/v1/videos/generations",
  "sora-2": "openai/v1/videos",
  "sora-2-pro": "openai/v1/videos",
  "topaz-upscale-video": "topaz/upscale/video",
};

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

    // Режим генерации изображений
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

    // Режим генерации видео через официальные воркфлоу Picsart
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

    // Формирование параметров строго по SDK схеме
    const params = {
      prompt: prompt.trim(),
      aspectRatio: aspectRatio,
      resolution: quality,
      duration: Number(duration) || 5,
      generateAudio: withAudio,
    };

    if (hdr) params.hdr = true;
    if (loop) params.loop = true;

    if (startFrame) {
      if (model.includes("grok") || model.includes("sora")) {
        params.imageUrls = [startFrame];
      } else {
        params.startFrame = startFrame;
      }
    }
    if (endFrame) params.endFrame = endFrame;
    if (videoUrl) {
      params.videoUrls = [videoUrl];
      if (model === "topaz-upscale-video") {
        params.videoUrl = videoUrl;
        params.model = topazModel;
        delete params.prompt;
        delete params.aspectRatio;
      }
    }
    if (audioUrl) params.audioUrls = [audioUrl];

    const workflow = WORKFLOW_MAP[model] || "seedance";

    const res = await fetch(`https://genai-api.picsart.io/v1/workflows/${workflow}/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
        "X-Picsart-API-Key": apiKey,
      },
      body: JSON.stringify(params),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.detail || data?.message || `Ошибка Picsart Video API (HTTP ${res.status})` },
        { status: res.status }
      );
    }

    const inferenceId = data?.id || data?.inference_id || data?.data?.id;
    const directUrl = data?.url || data?.results?.[0]?.url || data?.data?.url;

    return NextResponse.json({
      success: true,
      mode: "video",
      inference_id: inferenceId,
      url: directUrl || null,
      raw: data,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Ошибка сервера" }, { status: 500 });
  }
}
