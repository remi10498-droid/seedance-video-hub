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

    // Режим генерации изображений
    if (mode === "image" || model.includes("flux-2-pro") || model.includes("seedream") || model.includes("grok-imagine-image")) {
      const size = formData.get("resolution") || "1024x1024";
      const [w, h] = size.includes("x") ? size.split("x") : (size === "2k" ? ["2048", "2048"] : ["1024", "1024"]);

      const imgRes = await fetch(`https://api.picsart.com/v1/models/${model}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          width: Number(w),
          height: Number(h),
          count: 1,
        }),
      });

      const imgData = await imgRes.json().catch(() => null);
      if (!imgRes.ok) {
        return NextResponse.json({ error: imgData?.message || imgData?.detail || "Ошибка генерации изображения" }, { status: imgRes.status });
      }

      const imgUrl = imgData?.url || imgData?.results?.[0]?.url || imgData?.data?.[0]?.url;
      return NextResponse.json({ success: true, mode: "image", url: imgUrl, inference_id: imgData?.id });
    }

    // Режим генерации видео по спецификации официального SDK
    const quality = formData.get("quality") || formData.get("resolution") || "1080p";
    const duration = formData.get("duration") || "5";
    const aspectRatio = formData.get("aspect_ratio") || formData.get("aspectRatio") || "16:9";
    const withAudio = formData.get("with_audio") === "true";
    const hdr = formData.get("hdr") === "true";
    const loop = formData.get("loop") === "true";
    const topazModel = formData.get("topaz_model") || "Proteus";
    
    const startFrame = formData.get("start_frame");
    const endFrame = formData.get("end_frame");
    const videoUrl = formData.get("video_url");
    const audioUrl = formData.get("audio_url");

    // Формирование параметров
    const params = {
      prompt: prompt.trim(),
      aspectRatio: aspectRatio,
      resolution: quality,
      duration: Number(duration) || 5,
      generateAudio: withAudio,
    };

    if (hdr) params.hdr = true;
    if (loop) params.loop = true;
    if (model === "topaz-upscale-video") {
      params.model = topazModel;
      if (videoUrl) params.videoUrl = videoUrl;
      delete params.prompt;
      delete params.aspectRatio;
    }

    if (startFrame) {
      if (model.includes("grok") || model.includes("flux-3") || model.includes("sora")) {
        params.imageUrls = [startFrame];
      } else {
        params.startFrame = startFrame;
      }
    }
    if (endFrame) params.endFrame = endFrame;
    if (videoUrl && model !== "topaz-upscale-video") {
      params.videoUrls = [videoUrl];
    }
    if (audioUrl) {
      params.audioUrls = [audioUrl];
    }

    // Вызов модели через официальный эндпоинт
    const res = await fetch(`https://api.picsart.com/v1/models/${model}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(params),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      // Запасной шлюз workflows, если прямой models/{model}/generate недоступен
      const fallbackWorkflow = model.includes("extend") ? "seedance" : (startFrame ? "image2video" : "text2video");
      const fbRes = await fetch(`https://genai-api.picsart.io/v1/workflows/${fallbackWorkflow}/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Picsart-API-Key": apiKey,
        },
        body: JSON.stringify(params),
      });

      const fbData = await fbRes.json().catch(() => null);
      if (!fbRes.ok) {
        return NextResponse.json({ error: data?.message || data?.detail || fbData?.detail || "Ошибка Picsart API" }, { status: res.status });
      }

      return NextResponse.json({
        success: true,
        mode: "video",
        inference_id: fbData?.id || fbData?.inference_id,
        url: fbData?.url || fbData?.results?.[0]?.url || null,
        raw: fbData,
      });
    }

    const inferenceId = data?.id || data?.inference_id;
    const directUrl = data?.url || data?.results?.[0]?.url;

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
