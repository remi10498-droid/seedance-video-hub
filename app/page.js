"use client";
import React, { useState, useEffect, useRef } from "react";

export default function Home() {
  const [mode, setMode] = useState("video");
  const [password, setPassword] = useState("");
  const [prompt, setPrompt] = useState("");
  
  // Модели и настройки видео
  const [videoModel, setVideoModel] = useState("urn:air:seedance:model:seedance:seedance-2.5@1");
  const [duration, setDuration] = useState("5");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [quality, setQuality] = useState("720p");
  const [withAudio, setWithAudio] = useState(false);

  // Файлы начального и конечного кадров
  const [firstFrameFile, setFirstFrameFile] = useState(null);
  const [lastFrameFile, setLastFrameFile] = useState(null);

  // Модели и настройки картинок
  const [imageModel, setImageModel] = useState("urn:air:google:model:gemini:nano-banana-pro@1");
  const [imageSize, setImageSize] = useState("1024x1024");

  // Статусы и баланс
  const [balance, setBalance] = useState("Загрузка...");
  const [cost, setCost] = useState(15);
  const [statusText, setStatusText] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState("");
  const [resultType, setResultType] = useState("");
  const [error, setError] = useState("");

  const pollTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // Расчет стоимости
  useEffect(() => {
    if (mode === "image") {
      let base = 2;
      if (imageModel.includes("nano-banana") || imageModel.includes("seedream")) base = 3;
      if (imageModel.includes("flux") || imageModel.includes("midjourney")) base = 5;
      if (imageSize.includes("2048")) base += 2;
      setCost(base);
    } else {
      let baseRate = 15;
      if (videoModel.includes("seedance-2.0")) baseRate = 10;
      if (videoModel.includes("kling")) baseRate = 25;
      if (videoModel.includes("wan")) baseRate = 20;
      if (videoModel.includes("veo") || videoModel.includes("runway")) baseRate = 30;
      if (videoModel.includes("grok")) baseRate = 35;
      if (videoModel.includes("sora")) baseRate = 45;

      const durNum = Number(duration) || 5;
      let durMult = 1;
      if (durNum === 10) durMult = 1.8;
      else if (durNum === 20) durMult = 3.0;
      else if (durNum === 25) durMult = 3.6;
      else if (durNum === 30) durMult = 4.2;

      let qMult = quality === "480p" ? 0.8 : quality === "1080p" ? 1.5 : 1;
      let audioExtra = withAudio ? 3 : 0;

      setCost(Math.round(baseRate * durMult * qMult) + audioExtra);
    }
  }, [mode, videoModel, imageModel, duration, quality, withAudio, imageSize]);

  const fetchBalance = async () => {
    try {
      const res = await fetch(`/api/balance?t=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      if (data.balance) setBalance(data.balance);
    } catch {
      setBalance("—");
    }
  };

  useEffect(() => {
    fetchBalance();
  }, []);

  const pollStatus = (inferenceId) => {
    setStatusText("Нейросеть рендерит результат... (~30-60 сек)");
    let attempts = 0;
    const maxAttempts = 70;

    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      attempts++;

      if (attempts > maxAttempts) {
        clearInterval(pollTimerRef.current);
        setError("Таймаут генерации. Попробуйте еще раз.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/status?id=${inferenceId}&t=${Date.now()}`);
        const data = await res.json();
        const st = String(data.status || data.data?.status || "").toUpperCase();

        if (st === "DONE" || st === "SUCCESS" || st === "COMPLETED") {
          clearInterval(pollTimerRef.current);
          const finalUrl = data.url || data.data?.[0]?.url || data.data?.url || data.output?.[0];
          if (finalUrl) {
            setResultUrl(finalUrl);
            setResultType(mode);
            setStatusText("Готово!");
          } else {
            setError("Результат готов, но ссылка не получена.");
          }
          setLoading(false);
          setTimeout(fetchBalance, 1500);
        } else if (st === "FAILED" || st === "ERROR") {
          clearInterval(pollTimerRef.current);
          setError(data.error || "Генерация отклонена сервисом.");
          setLoading(false);
        } else {
          setStatusText(`Рендеринг... (${Math.round(attempts * 2.5)}с)`);
        }
      } catch {
        clearInterval(pollTimerRef.current);
        setError("Ошибка проверки статуса генерации.");
        setLoading(false);
      }
    }, 2500);
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResultUrl("");
    setStatusText("Отправка параметров в Picsart...");

    const formData = new FormData();
    formData.append("mode", mode);
    formData.append("password", password);
    formData.append("prompt", prompt);

    if (mode === "image") {
      formData.append("size", imageSize);
      formData.append("model", imageModel);
    } else {
      formData.append("model", videoModel);
      formData.append("duration", duration);
      formData.append("aspect_ratio", aspectRatio);
      formData.append("quality", quality);
      formData.append("with_audio", String(withAudio));
      
      if (firstFrameFile) formData.append("first_frame_file", firstFrameFile);
      if (lastFrameFile) formData.append("last_frame_file", lastFrameFile);
    }

    try {
      const res = await fetch("/api/generate", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка запроса");

      if (mode === "image" && data.url) {
        setResultUrl(data.url);
        setResultType("image");
        setLoading(false);
        setTimeout(fetchBalance, 1000);
        return;
      }

      const inferenceId = data.inference_id || data.id || data.data?.id;
      if (inferenceId) {
        pollStatus(inferenceId);
      } else if (data.url) {
        setResultUrl(data.url);
        setResultType(mode);
        setLoading(false);
        setTimeout(fetchBalance, 1000);
      } else {
        throw new Error("Не получен ID генерации.");
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: "780px", margin: "30px auto", padding: "24px", fontFamily: "sans-serif", background: "#121318", color: "#eee", borderRadius: "12px", boxShadow: "0 8px 30px rgba(0,0,0,0.5)" }}>
      {/* Шапка */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
        <h2 style={{ margin: 0, fontSize: "20px" }}>Picsart AI Studio (100+ Models)</h2>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div style={{ background: "#1c1e24", padding: "6px 12px", borderRadius: "20px", border: "1px solid #333", fontSize: "13px", color: "#fbbf24" }}>
            🪙 ~{cost} кр.
          </div>
          <div style={{ background: "#1c1e24", padding: "6px 12px", borderRadius: "20px", border: "1px solid #333", fontSize: "13px", fontWeight: "bold", color: "#818cf8" }}>
            ⚡ Баланс: {balance}
          </div>
        </div>
      </div>

      {/* Переключатель режимов */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", background: "#1a1b22", padding: "4px", borderRadius: "8px", width: "fit-content" }}>
        <button
          type="button"
          onClick={() => setMode("video")}
          style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: mode === "video" ? "#4f46e5" : "transparent", color: "#fff", cursor: "pointer", fontWeight: "bold" }}
        >
          🎬 Видео (Seedance / Kling / Wan / Sora)
        </button>
        <button
          type="button"
          onClick={() => setMode("image")}
          style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: mode === "image" ? "#4f46e5" : "transparent", color: "#fff", cursor: "pointer", fontWeight: "bold" }}
        >
          🖼 Фото (Nano Banana / Seedream / FLUX)
        </button>
      </div>
      
      <form onSubmit={handleGenerate} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div>
          <label style={{ fontSize: "12px", color: "#aaa" }}>Код доступа:</label>
          <input
            type="password"
            placeholder="Введите пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: "100%", padding: "10px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
          />
        </div>

        <div>
          <label style={{ fontSize: "12px", color: "#aaa" }}>Промпт ({mode === "video" ? "описание сцены и движения" : "описание изображения"}):</label>
          <textarea
            placeholder="Опишите детально сцену..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            required
            rows={3}
            style={{ width: "100%", padding: "10px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
          />
        </div>

        {/* НАСТРОЙКИ ВИДЕО */}
        {mode === "video" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", background: "#171920", padding: "12px", borderRadius: "8px", border: "1px solid #282a36" }}>
              <div>
                <label style={{ fontSize: "12px", color: "#60a5fa", fontWeight: "bold", display: "block", marginBottom: "4px" }}>
                  🖼 Начальный кадр (файл):
                </label>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={(e) => setFirstFrameFile(e.target.files[0] || null)}
                  style={{ fontSize: "12px", color: "#ccc", width: "100%" }}
                />
                {firstFrameFile && (
                  <span style={{ fontSize: "11px", color: "#34d399", display: "block", marginTop: "2px" }}>
                    ✓ Выбран: {firstFrameFile.name}
                  </span>
                )}
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "#60a5fa", fontWeight: "bold", display: "block", marginBottom: "4px" }}>
                  🏁 Конечный кадр (файл):
                </label>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={(e) => setLastFrameFile(e.target.files[0] || null)}
                  style={{ fontSize: "12px", color: "#ccc", width: "100%" }}
                />
                {lastFrameFile && (
                  <span style={{ fontSize: "11px", color: "#34d399", display: "block", marginTop: "2px" }}>
                    ✓ Выбран: {lastFrameFile.name}
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: "8px" }}>
              <div>
                <label style={{ fontSize: "12px", color: "#aaa" }}>Модель видео:</label>
                <select
                  value={videoModel}
                  onChange={(e) => setVideoModel(e.target.value)}
                  style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
                >
                  <option value="urn:air:seedance:model:seedance:seedance-2.5@1">✨ Seedance 2.5</option>
                  <option value="urn:air:seedance:model:seedance:seedance-2.0@1">🎬 Seedance 2.0 (Fast)</option>
                  <option value="urn:air:kling:model:kling:kling-3.0-omni@1">🎭 Kling 3.0 Omni</option>
                  <option value="urn:air:wan:model:wan:wan-2.7@1">🎥 Wan 2.7</option>
                  <option value="urn:air:google:model:veo:veo-3.1@1">🌟 Google Veo 3.1</option>
                  <option value="urn:air:runway:model:gen4:gen4@1">🚀 Runway Gen 4</option>
                  <option value="urn:air:xai:model:grok:grok-imagine-video@1">⚡ Grok Imagine Video</option>
                  <option value="urn:air:openai:model:sora:sora-2.0@1">💫 OpenAI Sora 2.0</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "#aaa" }}>Качество:</label>
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                  style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
                >
                  <option value="480p">480p</option>
                  <option value="720p">720p (HD)</option>
                  <option value="1080p">1080p (FHD)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "#aaa" }}>Длина:</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
                >
                  <option value="5">5 сек</option>
                  <option value="10">10 сек</option>
                  <option value="20">20 сек</option>
                  <option value="25">25 сек</option>
                  <option value="30">30 сек</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "#aaa" }}>Формат:</label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
                >
                  <option value="16:9">16:9 (Гориз.)</option>
                  <option value="9:16">9:16 (Вертик.)</option>
                  <option value="1:1">1:1 (Квадрат)</option>
                </select>
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer", marginTop: "4px" }}>
              <input
                type="checkbox"
                checked={withAudio}
                onChange={(e) => setWithAudio(e.target.checked)}
              />
              🔊 Включить звуковое сопровождение (+3 кр.)
            </label>
          </>
        )}

        {/* НАСТРОЙКИ КАРТИНОК */}
        {mode === "image" && (
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "10px" }}>
            <div>
              <label style={{ fontSize: "12px", color: "#aaa" }}>Модель картинок:</label>
              <select
                value={imageModel}
                onChange={(e) => setImageModel(e.target.value)}
                style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
              >
                <option value="urn:air:google:model:gemini:nano-banana-pro@1">🍌 Nano Banana Pro</option>
                <option value="urn:air:seedream:model:seedream:seedream-4k@1">🌊 Seedream Ultra 4K</option>
                <option value="urn:air:bfl:model:flux:flux-1-pro@1">⚡ FLUX.1 Pro (BFL)</option>
                <option value="urn:air:kling:model:kling:v2-image@1">🎨 Kling V2 Image</option>
                <option value="urn:air:midjourney:model:midjourney:v6@1">🌌 Midjourney v6 Style</option>
                <option value="urn:air:recraft:model:recraft:recraft-v3@1">📐 Recraft V3</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: "12px", color: "#aaa" }}>Разрешение (включая 2K):</label>
              <select
                value={imageSize}
                onChange={(e) => setImageSize(e.target.value)}
                style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
              >
                <option value="1024x1024">1:1 HD (1024x1024)</option>
                <option value="1280x720">16:9 HD (1280x720)</option>
                <option value="720x1280">9:16 HD (720x1280)</option>
                <option value="2048x2048">🌟 1:1 2K Ultra (2048x2048)</option>
                <option value="2048x1152">🌟 16:9 2K Ultra (2048x1152)</option>
                <option value="1152x2048">🌟 9:16 2K Ultra (1152x2048)</option>
              </select>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{ marginTop: "10px", padding: "12px", background: loading ? "#444" : "#4f46e5", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading ? statusText : `Сгенерировать (~${cost} кр.)`}
        </button>
      </form>

      {error && <p style={{ color: "#f87171", marginTop: "15px", background: "#2b1517", padding: "10px", borderRadius: "6px" }}>{error}</p>}

      {/* Вывод результата */}
      {resultUrl && (
        <div style={{ marginTop: "20px" }}>
          <h3>Результат:</h3>
          {resultType === "video" ? (
            <div>
              <video key={resultUrl} src={resultUrl} controls autoPlay playsInline style={{ width: "100%", borderRadius: "8px", marginTop: "8px", background: "#000" }} />
              <a href={resultUrl} target="_blank" rel="noreferrer" download style={{ display: "inline-block", marginTop: "8px", color: "#818cf8", textDecoration: "none" }}>⬇ Скачать видео (.mp4)</a>
            </div>
          ) : (
            <div>
              <img src={resultUrl} alt="AI Result" style={{ width: "100%", borderRadius: "8px", marginTop: "8px", border: "1px solid #333" }} />
              <a href={resultUrl} target="_blank" rel="noreferrer" download style={{ display: "inline-block", marginTop: "8px", color: "#818cf8", textDecoration: "none" }}>⬇ Открыть оригинал (.png)</a>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
