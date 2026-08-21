export const dynamic = 'force-dynamic';

async function uploadToPicsartStorage(base64Data, apiKey) {
  try {
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    const base64Clean = matches && matches[2] ? matches[2] : base64Data;
    const buffer = Buffer.from(base64Clean, 'base64');

    const formData = new FormData();
    const blob = new Blob([buffer], { type: 'image/jpeg' });
    formData.append('file', blob, 'reference.jpg');

    const res = await fetch('https://genai-api.picsart.io/v1/upload', {
      method: 'POST',
      headers: {
        'X-Picsart-API-Key': apiKey,
        'accept': 'application/json'
      },
      body: formData
    });

    const data = await res.json().catch(() => null);
    return data?.data?.url || data?.url || data?.file_url || null;
  } catch (err) {
    return null;
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return Response.json({ ok: false, error: "Неверный формат JSON" }, { status: 400 });
    }

    let {
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

    if (key !== process.env.ACCESS_CODE && key !== "SEED" && key !== "SEED480") {
      return Response.json({ ok: false, error: "Неверный код доступа" }, { status: 401 });
    }

    const apiKey = process.env.PICSART_API_KEY;
    if (!apiKey) {
      return Response.json({ ok: false, error: "Ключ PICSART_API_KEY не задан в Vercel" }, { status: 500 });
    }

    if (!prompt) {
      return Response.json({ ok: false, error: "Введите текст промпта" }, { status: 400 });
    }

    let finalImageUrl = referenceUrl;
    if (referenceUrl && referenceUrl.startsWith("data:image")) {
      const uploadedUrl = await uploadToPicsartStorage(referenceUrl, apiKey);
      if (uploadedUrl) {
        finalImageUrl = uploadedUrl;
      }
    }

    const headers = {
      "accept": "application/json",
      "Content-Type": "application/json",
      "X-Picsart-API-Key": apiKey
    };

    // --- РЕЖИМ КАРТИНОК ---
    if (mode === "t2i" || mode === "i2i" || mode === "image") {
      let width = 1280, height = 720;
      if (ratio === "9:16") { width = 720; height = 1280; }
      else if (ratio === "1:1") { width = 1024; height = 1024; }

      let imgModel = "flux-pro";
      if (model === "grokimagineimage") imgModel = "flux-dev";
      else if (model === "klingv3") imgModel = "sdxl";

      const payload = {
        prompt,
        model: imgModel,
        width,
        height,
        count: 1
      };

      if (finalImageUrl && finalImageUrl.startsWith("http")) {
        payload.image_url = finalImageUrl;
      }

      const endpoint = (finalImageUrl && finalImageUrl.startsWith("http"))
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
          error: data?.detail || data?.message || "Ошибка генерации картинки"
        }, { status: res.status });
      }

      const imgUrl = data?.data?.[0]?.url || data?.url;
      return Response.json({
        ok: true,
        mode: "image",
        url: imgUrl,
        real_model: data?.model || imgModel,
        credits_spent: data?.consumed_credits ?? 2
      });
    }

    // --- РЕЖИМ ВИДЕО ---
    let actualModel = "urn:air:seedance:model:seedance:seedance-2.5@1";
    if (model === "klingv3") {
      actualModel = "urn:air:kling:model:kling:kling-v1.5-pro@1";
    } else if (model === "klingv3turbo") {
      actualModel = "urn:air:kling:model:kling:kling-v1.5-turbo@1";
    } else if (model === "grokimaginevideo") {
      actualModel = "urn:air:xai:model:grok:grok-imagine-video@1";
    }

    let durationNum = Number(seconds) || 5;
    const hasImage = Boolean(finalImageUrl && (finalImageUrl.startsWith("http") || finalImageUrl.startsWith("data:image")));

    const payload = {
      prompt,
      model: actualModel,
      duration_seconds: durationNum,
      length: durationNum,
      duration: durationNum,
      seconds: durationNum,
      quality,
      aspect_ratio: ratio,
      ratio
    };

    if (hasImage) {
      payload.image_url = finalImageUrl;
      payload.image = finalImageUrl;
      payload.init_image = finalImageUrl;
    }

    if (audio) {
      payload.with_audio = true;
    }

    const endpoint = hasImage
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
        error: data?.detail || data?.message || data?.error || "Ошибка генерации видео Picsart"
      }, { status: res.status });
    }

    const inferenceId = data?.inference_id || data?.id || data?.data?.id;

    return Response.json({
      ok: true,
      mode: "video",
      inference_id: inferenceId,
      credits_spent: data?.consumed_credits ?? null
    });

  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
