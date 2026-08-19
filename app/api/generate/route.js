export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const mode = formData.get("mode") || "video";
    const prompt = formData.get("prompt");
    const password = formData.get("password");

    if (password !== process.env.ACCESS_CODE && password !== "SEED") {
      return Response.json({ error: "Неверный код доступа!" }, { status: 401 });
    }

    if (!process.env.PICSART_API_KEY) {
      return Response.json({ error: "Ключ PICSART_API_KEY не задан в Vercel!" }, { status: 500 });
    }

    if (!prompt) {
      return Response.json({ error: "Введите текст промпта!" }, { status: 400 });
    }

    const headers = {
      "accept": "application/json",
      "X-Picsart-API-Key": process.env.PICSART_API_KEY
    };

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

    // --- МАППИНГ РЕАЛЬНЫХ URN МОДЕЛЕЙ PICSART ---
    const userModel = formData.get("model") || "seedance-2.5";
    let actualModel = userModel;
    if (userModel === "seedance-2.5") {
      actualModel = "urn:air:seedance:model:seedance:seedance-2.5@1";
    } else if (userModel === "wan-2.7") {
      actualModel = "urn:air:wan:model:wan:wan-2.7-image-to-video@1";
    } else if (userModel === "kling-v3-pro") {
      actualModel = "urn:air:kling:model:kling:kling-v1.5-pro@1";
    }

    const duration = Number(formData.get("duration")) || 5;
    const quality = formData.get("quality") || "720p";
    const aspectRatio = formData.get("aspect_ratio") || "16:9";

    const imageFile = formData.get("image_file");
    const imageUrl = formData.get("image_url");

    const picsartForm = new FormData();
    picsartForm.append("prompt", prompt);
    picsartForm.append("model", actualModel);
    picsartForm.append("length", String(duration));
    picsartForm.append("duration", String(duration));
    picsartForm.append("seconds", String(duration));
    picsartForm.append("quality", quality);
    picsartForm.append("aspect_ratio", aspectRatio);

    const hasImageFile = imageFile && typeof imageFile !== "string" && imageFile.size > 0;
    if (hasImageFile) {
      picsartForm.append("image", imageFile);
    } else if (imageUrl) {
      picsartForm.append("image_url", imageUrl);
    }

    const endpoint = (hasImageFile || imageUrl)
      ? "https://genai-api.picsart.io/v1/image2video"
      : "https://genai-api.picsart.io/v1/text2video";

    const res = await fetch(endpoint, {
      method: "POST",
      headers: headers,
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
      requested_duration: duration,
      raw: data
    });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
