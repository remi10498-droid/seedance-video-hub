export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const mode = formData.get("mode") || "video";
    const prompt = formData.get("prompt");
    const password = formData.get("password");

    // Проверка доступа
    if (password !== process.env.ACCESS_CODE && password !== "SEED") {
      return Response.json({ error: "Неверный код доступа!" }, { status: 401 });
    }

    if (!process.env.PICSART_API_KEY) {
      return Response.json({ error: "Ключ PICSART_API_KEY не задан в Vercel!" }, { status: 500 });
    }

    if (!prompt) {
      return Response.json({ error: "Введите текст промпта!" }, { status: 400 });
    }

    // --- РЕЖИМ КАРТИНОК ---
    if (mode === "image") {
      const payload = {
        prompt: prompt,
        negative_prompt: "",
        model: formData.get("model") || "flux-pro",
        width: Number(formData.get("width")) || 1024,
        height: Number(formData.get("height")) || 1024,
        count: 1
      };

      const res = await fetch("https://genai-api.picsart.io/v1/text2image", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "Content-Type": "application/json",
          "X-Picsart-API-Key": process.env.PICSART_API_KEY
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return Response.json({
          error: data?.detail || data?.message || "Ошибка Picsart Image API",
          raw: data
        }, { status: res.status });
      }

      const imgUrl = data?.data?.[0]?.url || data?.url;
      return Response.json({ success: true, mode: "image", url: imgUrl, raw: data });
    }

    // --- РЕЖИМ ВИДЕО ---
    const userModel = formData.get("model") || "seedance-2.5";
    let actualModel = "urn:air:seedance:model:seedance:seedance-2.5@1";
    if (userModel === "kling-v3-pro") {
      actualModel = "urn:air:kling:model:kling:kling-v1.5-pro@1";
    } else if (userModel === "wan-2.7") {
      actualModel = "urn:air:wan:model:wan:wan-2.7-image-to-video@1";
    } else if (userModel === "grok-video") {
      actualModel = "urn:air:xai:model:grok:grok-imagine-video@1";
    } else if (userModel === "veo-3.1") {
      actualModel = "urn:air:google:model:veo:veo-3.1@1";
    }

    let durationNum = Number(formData.get("duration")) || 5;
    if (durationNum > 20) durationNum = 20;

    const quality = formData.get("quality") || "720p";
    const aspectRatio = formData.get("aspect_ratio") || "16:9";
    const withAudio = formData.get("with_audio") === "true";
    const imageFile = formData.get("image_file");
    const imageUrl = formData.get("image_url");

    const picsartForm = new FormData();
    picsartForm.append("prompt", prompt);
    picsartForm.append("model", actualModel);
    picsartForm.append("length", String(durationNum));
    picsartForm.append("duration", String(durationNum));
    picsartForm.append("quality", quality);
    picsartForm.append("aspect_ratio", aspectRatio);

    if (withAudio) {
      picsartForm.append("with_audio", "true");
    }

    const hasFile = imageFile && typeof imageFile !== "string" && imageFile.size > 0;

    if (hasFile) {
      picsartForm.append("image", imageFile);
    } else if (imageUrl && imageUrl.startsWith("http")) {
      picsartForm.append("image_url", imageUrl);
    }

    // Выбор эндпоинта
    const endpoint = (hasFile || (imageUrl && imageUrl.startsWith("http")))
      ? "https://genai-api.picsart.io/v1/image2video"
      : "https://genai-api.picsart.io/v1/text2video";

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "X-Picsart-API-Key": process.env.PICSART_API_KEY
      },
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
