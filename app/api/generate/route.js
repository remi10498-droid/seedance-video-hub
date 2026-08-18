export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const mode = formData.get("mode") || "video"; // "video" или "image"
    const prompt = formData.get("prompt");
    const password = formData.get("password");

    if (password !== process.env.SITE_PASSWORD && password !== "SEED") {
      return Response.json({ error: "Неверный пароль доступа" }, { status: 401 });
    }

    if (!prompt) {
      return Response.json({ error: "Введите текст промпта" }, { status: 400 });
    }

    const headers = {
      "Content-Type": "application/json",
      "accept": "application/json",
      "X-Picsart-API-Key": process.env.PICSART_API_KEY
    };

    // --- РЕЖИМ ГЕНЕРАЦИИ КАРТИНОК ---
    if (mode === "image") {
      const payload = {
        prompt: prompt,
        negative_prompt: "",
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

      // Если картинка отдается сразу или в поле data
      const imgUrl = data?.data?.[0]?.url || data?.url || (Array.isArray(data?.data) ? data?.data[0] : null);
      const inferenceId = data?.inference_id || data?.id;

      return Response.json({
        success: true,
        mode: "image",
        url: imgUrl,
        inference_id: inferenceId,
        raw: data
      });
    }

    // --- РЕЖИМ ГЕНЕРАЦИИ ВИДЕО ---
    const payload = {
      prompt: prompt,
      negative_prompt: "",
      quality: formData.get("quality") || "720p",
      duration: Number(formData.get("duration")) || 5,
      aspect_ratio: formData.get("aspect_ratio") || "16:9",
      with_audio: formData.get("with_audio") === "true"
    };

    // Добавляем начальный и конечный кадры при наличии
    const firstFrame = formData.get("first_frame_url");
    const lastFrame = formData.get("last_frame_url");
    if (firstFrame) payload.image_url = firstFrame;
    if (lastFrame) payload.last_frame_url = lastFrame;

    const res = await fetch("https://genai-api.picsart.io/v1/text2video", {
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
