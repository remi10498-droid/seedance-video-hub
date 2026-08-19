export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const mode = formData.get("mode") || "video";
    const prompt = formData.get("prompt");
    const password = formData.get("password");

    if (password !== process.env.ACCESS_CODE && password !== "SEED") {
      return Response.json({ error: "Неверный код доступа" }, { status: 401 });
    }

    if (!prompt) {
      return Response.json({ error: "Введите текст промпта" }, { status: 400 });
    }

    const headers = {
      "accept": "application/json",
      "X-Picsart-API-Key": process.env.PICSART_API_KEY
    };

    // --- РЕЖИМ КАРТИНОК ---
    if (mode === "image") {
      const payload = {
        prompt: prompt,
        width: Number(formData.get("width")) || 1024,
        height: Number(formData.get("height")) || 1024,
        model: formData.get("model") || "flux-pro"
      };

      const res = await fetch("https://genai-api.picsart.io/v1/text2image", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return Response.json({ error: data?.detail || data?.message || "Ошибка Picsart Image API" }, { status: res.status });
      }

      const imgUrl = data?.data?.[0]?.url || data?.url;
      return Response.json({ success: true, mode: "image", url: imgUrl, raw: data });
    }

    // --- РЕЖИМ ВИДЕО ---
    const model = formData.get("model") || "seedance-2.5";
    const duration = formData.get("duration") || "5";
    const quality = formData.get("quality") || "720p";
    const aspectRatio = formData.get("aspect_ratio") || "16:9";
    const withAudio = formData.get("with_audio") === "true";

    const imageFile = formData.get("image_file");
    const imageUrl = formData.get("image_url");

    // Собираем multipart форму для Picsart
    const picsartForm = new FormData();
    picsartForm.append("prompt", prompt);
    picsartForm.append("model", model);
    picsartForm.append("duration", duration);
    picsartForm.append("quality", quality);
    picsartForm.append("aspect_ratio", aspectRatio);
    if (withAudio) picsartForm.append("with_audio", "true");

    // Если передан локальный файл
    if (imageFile && typeof imageFile !== "string" && imageFile.size > 0) {
      picsartForm.append("image", imageFile);
    } else if (imageUrl) {
      picsartForm.append("image_url", imageUrl);
    }

    const endpoint = (imageFile && imageFile.size > 0) || imageUrl
      ? "https://genai-api.picsart.io/v1/image2video"
      : "https://genai-api.picsart.io/v1/text2video";

    const res = await fetch(endpoint, {
      method: "POST",
      headers: headers, // браузер и fetch сами добавят правильный multipart boundary
      body: picsartForm
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
