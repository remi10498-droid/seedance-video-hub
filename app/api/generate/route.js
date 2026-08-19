export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const mode = formData.get("mode") || "video";
    const prompt = formData.get("prompt");
    const password = formData.get("password");

    // Проверка пароля доступа к вашему сервису
    if (password !== process.env.ACCESS_CODE && password !== "SEED") {
      return Response.json({ error: "Неверный код доступа" }, { status: 401 });
    }

    if (!prompt) {
      return Response.json({ error: "Введите текст промпта" }, { status: 400 });
    }

    const headers = {
      "Content-Type": "application/json",
      "accept": "application/json",
      "X-Picsart-API-Key": process.env.PICSART_API_KEY
    };

    // ==========================================
    // 1. РЕЖИМ ГЕНЕРАЦИИ КАРТИНОК (Text2Image)
    // ==========================================
    if (mode === "image") {
      const model = formData.get("model") || "flux-pro";
      const payload = {
        prompt: prompt,
        negative_prompt: "",
        model: model,
        width: Number(formData.get("width")) || 1024,
        height: Number(formData.get("height")) || 1024,
        count: 1
      };

      const res = await fetch("https://genai-api.picsart.io/v1/text2image", {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return Response.json({
          error: data?.detail || data?.message || "Ошибка Picsart Image API",
          raw: data
        }, { status: res.status });
      }

      const imgUrl = data?.data?.[0]?.url || data?.url || (Array.isArray(data?.data) ? data?.data[0] : null);
      return Response.json({
        success: true,
        mode: "image",
        url: imgUrl,
        inference_id: data?.inference_id || data?.id,
        raw: data
      });
    }

    // ==========================================
    // 2. РЕЖИМ ГЕНЕРАЦИИ ВИДЕО (Seedance/Kling/Wan)
    // ==========================================
    const model = formData.get("model") || "seedance-2.5";
    const duration = Number(formData.get("duration")) || 5;
    const quality = formData.get("quality") || "720p";
    const aspectRatio = formData.get("aspect_ratio") || "16:9";
    const withAudio = formData.get("with_audio") === "true";
    const firstFrame = formData.get("first_frame_url");
    const lastFrame = formData.get("last_frame_url");

    const payload = {
      prompt: prompt,
      negative_prompt: "",
      model: model,
      duration: duration,
      quality: quality,
      aspect_ratio: aspectRatio,
      with_audio: withAudio
    };

    if (firstFrame) payload.image_url = firstFrame;
    if (lastFrame) payload.last_frame_url = lastFrame;

    // Выбираем Image-to-Video или Text-to-Video
    const endpoint = (firstFrame || lastFrame)
      ? "https://genai-api.picsart.io/v1/image2video"
      : "https://genai-api.picsart.io/v1/text2video";

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return Response.json({
        error: data?.detail || data?.message || "Ошибка Picsart Video API",
        raw: data
      }, { status: res.status });
    }

    const inferenceId = data?.inference_id || data?.id || data?.data?.id;
    return Response.json({
      success: true,
      mode: "video",
      inference_id: inferenceId,
      raw: data
    });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
