"use client";
import React, { useState, useEffect, useRef } from "react";

export default function Home() {
  const [mode, setMode] = useState("video");
  const [password, setPassword] = useState("");
  const [prompt, setPrompt] = useState("");

  // Настройки Видео
  const [videoModel, setVideoModel] = useState("seedance-2.5");
  const [duration, setDuration] = useState("30");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [quality, setQuality] = useState("720p");
  const [withAudio, setWithAudio] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState("");

  // Настройки Картинок
  const [imageModel, setImageModel] = useState("flux-pro");
  const [imageSize, setImageSize] = useState("1024x1024");

  // Статусы, баланс и результат
  const [balance, setBalance] = useState("...");
  const [cost, setCost] = useState(25);
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

  // Фактический калькулятор расхода кредитов Picsart
  useEffect(() => {
    if (mode === "image") {
      let imgCost = 2;
      if (imageModel === "flux-pro") imgCost = 4;
      else if (imageModel === "dall-e-3") imgCost = 5;
      else if (imageModel === "recraft-v4") imgCost = 3;
      setCost(imgCost);
    } else {
      let baseRate = 18;
      if (videoModel === "seedance-2.5") baseRate = 20;
      else if (videoModel === "kling-v3-pro") baseRate = 25;
      else if (videoModel === "wan-2.7") baseRate = 18;
      else if (videoModel === "sora-2.0") baseRate = 35;

      let durMult = 1.0;
      const d = Number(duration);
      if (d === 10) durMult = 1.8;
      else if (d === 20) durMult = 3.2;
      else if (d === 25) durMult = 3.9;
      else if (d === 30) durMult = 4.6;

      let qMult = 1.0;
      if (quality === "480p") qMult = 0.8;
      else if (quality === "1080p") qMult = 1.5;

      let extraAudio = withAudio ? 5 : 0;
      let total = Math.round(baseRate * durMult * qMult) + extraAudio;
      setCost(total);
    }
  }, [mode, videoModel, imageModel, duration, quality, withAudio]);

  const fetchBalance = async () => {
    try {
      const res = await fetch("/api/balance");
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
    setStatusText("Рендеринг видео нейросетью... (~30-90 сек)");
    let attempts = 0;
    const maxAttempts = 100;

    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(pollTimerRef.current);
        setError("Таймаут: Picsart обрабатывает задачу слишком долго.");
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/status?id=${inferenceId}`);
        const data = await res.json();
        const st = String(data.status || data.data?.status || "").toUpperCase();

        if (st === "DONE" || st === "SUCCESS" || st === "COMPLETED") {
          clearInterval(pollTimerRef.current);
          const finalUrl = data.url || data.data?.[0]?.url || data.data?.url || data.output?.[0];
          if (finalUrl) {
            setResultUrl(finalUrl);
            setResultType("video");
            setStatusText("Готово!");
          } else {
            setError("Видео готово, но ссылка не найдена в ответе.");
          }
          setLoading(false);
          fetchBalance();
        } else if (st === "FAILED" || st === "ERROR") {
          clearInterval(pollTimerRef.current);
          setError(data.error || "Генерация завершилась ошибкой со стороны Picsart API.");
          setLoading(false);
        } else {
          setStatusText(`Рендеринг видео... (${Math.round(attempts * 2.5)}с)`);
        }
      } catch {
        clearInterval(pollTimerRef.current);
        setError("Ошибка соединения при проверке статуса.");
        setLoading(false);
      }
    }, 2500);
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResultUrl("");
    setStatusText("Отправка запроса в Picsart...");

    const formData = new FormData();
    formData.append("mode", mode);
    formData.append("password", password);
    formData.append("prompt", prompt);

    if (mode === "image") {
      const [w, h] = imageSize.split("x");
      formData.append("width", w);
      formData.append("height", h);
      formData.append("model", imageModel);
    } else {
      formData.append("model", videoModel);
      formData.append("duration", duration);
      formData.append("aspect_ratio", aspectRatio);
      formData.append("quality", quality);
      formData.append("with_audio", String(withAudio));
      if (imageFile) {
        formData.append("image_file", imageFile);
      } else if (imageUrl) {
        formData.append("image_url", imageUrl);
      }
    }

    try {
      const res = await fetch("/api/generate", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка инициализации генерации");

      if (mode === "image" && data.url) {
        setResultUrl(data.url);
        setResultType("image");
        setLoading(false);
        fetchBalance();
        return;
      }

      const inferenceId = data.inference_id || data.id || data.data?.id;
      if (inferenceId) {
        pollStatus(inferenceId);
      } else if (data.url) {
        setResultUrl(data.url);
        setResultType(mode);
        setLoading(false);
        fetchBalance();
      } else {
        throw new Error("Picsart не вернул ID задачи.");
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: "760px", margin: "30px auto", padding: "24px", fontFamily: "sans-serif", background: "#121318", color: "#eee", borderRadius: "12px" }}>
      {/* Шапка сайта с расходом и балансом */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
        <h2 style={{ margin: 0, fontSize: "20px" }}>AI Media Studio (Seedance & GenAI)</h2>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div style={{ background: "#1c1e24", padding: "6px 12px", borderRadius: "20px", border: "1px solid #333", fontSize: "13px", color: "#fbbf24" }}>
            Расход: ~{cost} кр.
          </div>
          <div style={{ background: "#1c1e24", padding: "6px 12px", borderRadius: "20px", border: "1px solid #333", fontSize: "13px", color: "#818cf8" }}>
            ⚡ Баланс: {balance}
          </div>
        </div>
      </div>

      {/* Переключатель режима: Видео / Картинки */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <button
          type="button"
          onClick={() => setMode("video")}
          style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: mode === "video" ? "#4f46e5" : "#222", color: "#fff", cursor: "pointer", fontWeight: "bold" }}
        >
          🎬 Видео (Seedance 2.5 / Kling)
        </button>
        <button
          type="button"
          onClick={() => setMode("image")}
          style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: mode === "image" ? "#4f46e5" : "#222", color: "#fff", cursor: "pointer", fontWeight: "bold" }}
        >
          🖼 Изображения (Flux / SDXL)
        </button>
      </div>

      <form onSubmit={handleGenerate} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {/* Код доступа */}
        <div>
          <label style={{ fontSize: "12px", color: "#aaa" }}>Код доступа (пароль к сайту):</label>
          <input
            type="password"
            placeholder="SEED"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: "100%", padding: "10px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
          />
        </div>

        {/* Текстовый промпт */}
        <div>
          <label style={{ fontSize: "12px", color: "#aaa" }}>
            {mode === "video" ? "Промпт (описание сцены, ракурса и движений):" : "Промпт для генерации картинки:"}
          </label>
          <textarea
            placeholder={mode === "video" ? "A cinematic 30s continuous shot of a cozy rainy cafe, photorealistic lighting..." : "A futuristic cybernetic portrait, cinematic lighting, 8k..."}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            required
            rows={3}
            style={{ width: "100%", padding: "10px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
          />
        </div>

        {/* Блок настроек Видео */}
        {mode === "video" ? (
          <>
            {/* Загрузка фото с компьютера или по URL */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ fontSize: "12px", color: "#aaa" }}>Загрузить фото-референс с ПК:</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files ? e.target.files[0] : null)}
                  style={{ width: "100%", marginTop: "6px", fontSize: "12px", color: "#ccc" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", color: "#aaa" }}>Или прямая ссылка на фото:</label>
                <input
                  type="url"
                  placeholder="https://.../photo.jpg"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr 1fr", gap: "8px" }}>
              <div>
                <label style={{ fontSize: "12px", color: "#aaa" }}>Модель:</label>
                <select
                  value={videoModel}
                  onChange={(e) => setVideoModel(e.target.value)}
                  style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}
                >
                  <option value="seedance-2.5">Seedance 2.5 (ByteDance)</option>
                  <option value="kling-v3-pro">Kling V3.0 Pro</option>
                  <option value="wan-2.7">Wan 2.7</option>
                  <option value="sora-2.0">OpenAI Sora 2.0</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "#aaa" }}>Длина:</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}
                >
                  <option value="5">5 сек</option>
                  <option value="10">10 сек</option>
                  <option value="20">20 сек</option>
                  <option value="25">25 сек</option>
                  <option value="30">30 сек (Seedance full)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "#aaa" }}>Качество:</label>
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                  style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}
                >
                  <option value="480p">480p (Быстро)</option>
                  <option value="720p">720p (HD)</option>
                  <option value="1080p">1080p (Cinematic)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "#aaa" }}>Формат:</label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}
                >
                  <option value="16:9">16:9 (Гориз.)</option>
                  <option value="9:16">9:16 (Shorts/Reels)</option>
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
              Включить синтез звука и окружения (+5 кр.)
            </label>
          </>
        ) : (
          /* Блок настроек Картинок */
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div>
              <label style={{ fontSize: "12px", color: "#aaa" }}>Модель картинок:</label>
              <select
                value={imageModel}
                onChange={(e) => setImageModel(e.target.value)}
                style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}
              >
                <option value="flux-pro">FLUX.1 Pro (4 кр.)</option>
                <option value="sdxl">SDXL Photoreal (2 кр.)</option>
                <option value="recraft-v4">Recraft V4 Vector/Art (3 кр.)</option>
                <option value="dall-e-3">DALL-E 3 (5 кр.)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "#aaa" }}>Разрешение:</label>
              <select
                value={imageSize}
                onChange={(e) => setImageSize(e.target.value)}
                style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}
              >
                <option value="1024x1024">1024 × 1024 (1:1)</option>
                <option value="1280x720">1280 × 720 (16:9)</option>
                <option value="720x1280">720 × 1280 (9:16)</option>
              </select>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{ marginTop: "8px", padding: "12px", background: loading ? "#444" : "#4f46e5", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading ? statusText : `Сгенерировать (${cost} кр.)`}
        </button>
      </form>

      {error && <p style={{ color: "#f87171", marginTop: "15px", background: "#2b1517", padding: "10px", borderRadius: "6px" }}>{error}</p>}

      {/* Окно вывода результата */}
      {resultUrl && (
        <div style={{ marginTop: "20px" }}>
          <h3>Результат генерации:</h3>
          {resultType === "video" ? (
            <div>
              <video key={resultUrl} src={resultUrl} controls autoPlay playsInline style={{ width: "100%", borderRadius: "8px", marginTop: "8px" }} />
              <a href={resultUrl} target="_blank" rel="noreferrer" download style={{ display: "inline-block", marginTop: "8px", color: "#818cf8" }}>Скачать видеоролик (.mp4)</a>
            </div>
          ) : (
            <div>
              <img src={resultUrl} alt="Generated" style={{ width: "100%", borderRadius: "8px", marginTop: "8px" }} />
              <a href={resultUrl} target="_blank" rel="noreferrer" download style={{ display: "inline-block", marginTop: "8px", color: "#818cf8" }}>Скачать изображение</a>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
          )}
        </div>
      )}
    </main>
  );
}
