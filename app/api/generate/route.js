export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return Response.json({ ok: false, error: "Неверный формат JSON" }, { status: 400 });
    }

    const {
      key = "SEED",
      mode = "i2v",
      prompt,
      model = "seedance25",
      ratio = "16:9",
      quality = "720p",
      seconds = 5,
      audio = false,
      referenceUrl = null
    } = body;

    // Проверка доступа
    if (key !== process.env.ACCESS_CODE && key !== "SEED" && key !== "SEED480") {
      return Response.json({ ok: false, error: "Неверный код доступа" }, { status: 401 });
    }

    if (!process.env.PICSART_API_KEY) {
      return Response.json({ ok: false, error: "Ключ PICSART_API_KEY не задан в Vercel" }, { status: 500 });
    }

    if (!prompt) {
      return Response.json({ ok: false, error: "Введите текст промпта" }, { status: 400 });
    }

    const headers = {
      "accept": "application/json",
      "Content-Type": "application/json",
      "X-Picsart-API-Key": process.env.PICSART_API_KEY
    };

    // --- РЕЖИМ ГЕНЕРАЦИИ КАРТИНОК (t2i / i2i) ---
    if (mode === "t2i" || mode === "i2i" || mode === "image") {
      let width = 1024, height = 1024;
      if (ratio === "16:9") { width = 1280; height = 720; }
      else if (ratio === "9:16") { width = 720; height = 1280; }
      else if (ratio === "4:3") { width = 1024; height = 768; }
      else if (ratio === "3:4") { width = 768; height = 1024; }

      let imgModel = "flux-pro";
      if (model === "grokimagineimage") imgModel = "flux-dev";
      else if (model === "klingv3") imgModel = "sdxl";

      const payload = {
        prompt: prompt,
        negative_prompt: "",
        model: imgModel,
        width,
        height,
        count: 1
      };

      if (referenceUrl && referenceUrl.length > 5) {
        payload.image_url = referenceUrl;
      }

      const endpoint = (mode === "i2i" || (referenceUrl && referenceUrl.length > 5))
        ? "https://genai-api.picsart.io/v1/image2image"
        : "https://genai-api.picsart.io/v1/text2image";

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return Response.json({
          ok: false,
          error: data?.detail || data?.message || "Ошибка генерации картинки",
          raw: data
        }, { status: res.status });
      }

      const imgUrl = data?.data?.[0]?.url || data?.url;
      return Response.json({ ok: true, mode: "image", url: imgUrl, raw: data });
    }

    // --- РЕЖИМ ГЕНЕРАЦИИ ВИДЕО (t2v / i2v) ---
    let actualModel = "urn:air:seedance:model:seedance:seedance-2.5@1";
    if (model === "klingv3") {
      actualModel = "urn:air:kling:model:kling:kling-v1.5-pro@1";
    } else if (model === "klingv3turbo") {
      actualModel = "urn:air:kling:model:kling:kling-v1.5-turbo@1";
    } else if (model === "grokimaginevideo") {
      actualModel = "urn:air:xai:model:grok:grok-imagine-video@1";
    }

    let durationNum = Number(seconds) || 5;
    if (durationNum > 20) durationNum = 20;

    const payload = {
      prompt: prompt,
      model: actualModel,
      length: durationNum,
      duration: durationNum,
      quality: quality,
      aspect_ratio: ratio,
      ratio: ratio,
      with_audio: Boolean(audio)
    };

    const hasReference = Boolean(referenceUrl && referenceUrl.length > 5);
    if (hasReference) {
      payload.image_url = referenceUrl;
    }

    const endpoint = (hasReference || mode === "i2v")
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
        ok: false,
        error: data?.detail || data?.message || "Ошибка Picsart Video API",
        raw: data
      }, { status: res.status });
    }

    const inferenceId = data?.inference_id || data?.id || data?.data?.id;
    return Response.json({
      ok: true,
      mode: "video",
      inference_id: inferenceId,
      raw: data
    });

  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
