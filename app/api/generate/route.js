export const dynamic = 'force-dynamic';

// Загрузка локального фото напрямую в хранилище Picsart API
async function uploadToPicsartStorage(base64Data, apiKey) {
  try {
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    const buffer = matches && matches[2] ? Buffer.from(matches[2], 'base64') : Buffer.from(base64Data, 'base64');

    const formData = new FormData();
    const blob = new Blob([buffer], { type: 'image/jpeg' });
    formData.append('image', blob, 'ref.jpg');

    // Официальный шлюз загрузки Picsart
    const res = await fetch('https://genai-api.picsart.io/v1/upload', {
      method: 'POST',
      headers: {
        'X-Picsart-API-Key': apiKey,
        'accept': 'application/json'
      },
      body: formData
    });

    const data = await res.json().catch(() => null);
    if (data?.data?.url || data?.url) {
      return data.data?.url || data.url;
    }
  } catch (err) {
    console.error("Picsart upload error:", err);
  }
  return null;
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

    // Проверка пароля доступа
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

    // Если картинка загружена с ПК в Base64 — загружаем её напрямую в Picsart Storage
    let finalImageUrl = referenceUrl;
    if (referenceUrl && referenceUrl.startsWith("data:image")) {
      const internalPicsartUrl = await uploadToPicsartStorage(referenceUrl, apiKey);
      if (internalPicsartUrl) {
        finalImageUrl = internalPicsartUrl;
      }
    }

    const headers = {
      "accept": "application/json",
      "Content-Type": "application/json",
      "X-Picsart-API-Key": apiKey
    };

    // --- РЕЖИМ ГЕНЕРАЦИИ КАРТИНОК ---
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
          error: data?.detail || data?.message || "Ошибка генерации картинки",
          raw: data
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

    // --- РЕЖИМ ГЕНЕРАЦИИ ВИДЕО (Seedance 2.5, Kling, Grok) ---
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

    const hasPublicImage = Boolean(finalImageUrl && finalImageUrl.startsWith("http"));

    const payload = {
      prompt: prompt,
      model: actualModel,
      duration: durationNum,
      quality: quality,
      aspect_ratio: ratio
    };

    if (hasPublicImage) {
      payload.image_url = finalImageUrl;
    }

    if (audio) {
      payload.with_audio = true;
    }

    // Для генерации по референсу используем эндпоинт image2video
    const endpoint = hasPublicImage
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
        error: data?.detail || data?.message || data?.error || "Ошибка генерации видео Picsart",
        raw: data
      }, { status: res.status });
    }

    const inferenceId = data?.inference_id || data?.id || data?.data?.id;

    return Response.json({
      ok: true,
      mode: "video",
      inference_id: inferenceId,
      credits_spent: data?.consumed_credits ?? null,
      raw: data
    });

  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
