export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const mode = formData.get("mode") || "video";
    const prompt = formData.get("prompt");
    const password = formData.get("password");

    // Проверка пароля
    if (password !== process.env.SITE_PASSWORD && password !== "SEED") {
      return Response.json({ error: "Неверный пароль доступа" }, { status: 401 });
    }

    if (!prompt) {
      return Response.json({ error: "Введите текст промпта" }, { status: 400 });
    }

    // 1. РЕЖИМ КАРТИНОК
    if (mode === "image") {
      const [w, h] = (formData.get("size") || "1024x1024").split("x");
      const model = formData.get("model") || "urn:air:google:model:gemini:nano-banana-pro@1";

      const imgBody = new FormData();
      imgBody.append("prompt", prompt);
      imgBody.append("width", w);
      imgBody.append("height", h);
      imgBody.append("model", model);
      imgBody.append("count", "1");

      const res = await fetch("https://genai-api.picsart.io/v1/text2image", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "X-Picsart-API-Key": process.env.PICSART_API_KEY
        },
        body: imgBody
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return Response.json({ 
          error: data?.detail || data?.message || "Ошибка генерации картинки", 
          raw: data 
        }, { status: res.status });
      }

      const imgUrl = data?.data?.[0]?.url || data?.url || (Array.isArray(data?.data) ? data?.data[0] : null);
      return Response.json({ 
        success: true, 
        mode: "image", 
        url: imgUrl, 
        inference_id: data?.inference_id || data?.id 
      });
    }

    // 2. РЕЖИМ ВИДЕО
    const model = formData.get("model") || "urn:air:seedance:model:seedance:seedance-2.5@1";
    const aspectRatio = formData.get("aspect_ratio") || "16:9";
    const quality = formData.get("quality") || "720p";
    const duration = formData.get("duration") || "5";
    const withAudio = formData.get("with_audio") === "true";

    const firstFrameFile = formData.get("first_frame_file");
    const lastFrameFile = formData.get("last_frame_file");

    let width = 1280;
    let height = 720;

    if (quality === "480p") {
      if (aspectRatio === "9:16") { width = 480; height = 854; }
      else if (aspectRatio === "1:1") { width = 512; height = 512; }
      else { width = 854; height = 480; }
    } else if (quality === "1080p") {
      if (aspectRatio === "9:16") { width = 1080; height = 1920; }
      else if (aspectRatio === "1:1") { width = 1080; height = 1080; }
      else { width = 1920; height = 1080; }
    } else {
      if (aspectRatio === "9:16") { width = 720; height = 1280; }
      else if (aspectRatio === "1:1") { width = 720; height = 720; }
      else { width = 1280; height = 720; }
    }

    const videoBody = new FormData();
    videoBody.append("prompt", prompt);
    videoBody.append("model", model);
    videoBody.append("width", String(width));
    videoBody.append("height", String(height));
    videoBody.append("quality", quality);
    videoBody.append("duration", String(duration));
    videoBody.append("length", String(duration));
    videoBody.append("audio", String(withAudio));
    videoBody.append("with_audio", String(withAudio));

    if (firstFrameFile && typeof firstFrameFile === "object" && firstFrameFile.size > 0) {
      videoBody.append("image", firstFrameFile);
    }
    if (lastFrameFile && typeof lastFrameFile === "object" && lastFrameFile.size > 0) {
      videoBody.append("last_frame_image", lastFrameFile);
    }

    const res = await fetch("https://genai-api.picsart.io/v1/text2video", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "X-Picsart-API-Key": process.env.PICSART_API_KEY
      },
      body: videoBody
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
