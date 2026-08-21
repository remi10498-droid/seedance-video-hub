export const dynamic = 'force-dynamic';

// Вспомогательная функция загрузки Base64 на временный быстрый хостинг
async function uploadBase64ToPublicUrl(base64Data) {
  try {
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    const buffer = matches && matches[2] ? Buffer.from(matches[2], 'base64') : Buffer.from(base64Data, 'base64');
    
    const blob = new Blob([buffer], { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('file', blob, 'reference.jpg');

    const res = await fetch('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (data?.status === 'success' && data?.data?.url) {
      // tmpfiles.org возвращает ссылку вида https://tmpfiles.org/123/file.jpg, делаем прямой URL (/dl/)
      return data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
    }
  } catch (err) {
    console.error("Ошибка загрузки референса:", err);
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

    // Если картинка передана как Base64 с ПК — получаем реальную https:// ссылку для Picsart
    let finalImageUrl = referenceUrl;
    if (referenceUrl && referenceUrl.startsWith("data:image")) {
      const publicUrl = await uploadBase64ToPublicUrl(referenceUrl);
      if (publicUrl) {
        finalImageUrl = publicUrl;
      }
    }

    const headers = {
      "accept": "application/json",
      "Content-Type": "application/json",
      "X-Picsart-API-Key": process.env.PICSART_API_KEY
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

    // --- РЕЖИМ ГЕНЕРАЦИИ ВИДЕО ---
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

    // Seedance поддерживает аудио, если включено
    if (audio) {
      payload.with_audio = true;
    }

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
        error: data?.detail || data?.message || "Ошибка генерации видео Picsart",
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
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
