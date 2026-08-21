"use client";
import React, { useState, useEffect, useRef } from "react";

export default function Home() {
  const [mode, setMode] = useState("video");
  const [password, setPassword] = useState("");
  const [prompt, setPrompt] = useState("");

  // Модели и параметры
  const [videoModel, setVideoModel] = useState("seedance25");
  const [imageModel, setImageModel] = useState("seedream50pro");
  const [duration, setDuration] = useState("20");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [quality, setQuality] = useState("720p");
  const [withAudio, setWithAudio] = useState(false);

  // Референс
  const [previewRefUrl, setPreviewRefUrl] = useState(null);
  const [referenceUrl, setReferenceUrl] = useState("");

  // Баланс, цены и статусы
  const [balance, setBalance] = useState("...");
  const [pricing, setPricing] = useState(null);
  const [cost, setCost] = useState(140);
  const [statusText, setStatusText] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState("");
  const [resultType, setResultType] = useState("");
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const pollTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // Опрос баланса и цен через рабочий /api/balance
  const fetchBalance = async () => {
    try {
      const res = await fetch("/api/balance");
      const data = await res.json();
      if (data.ok || data.balance !== undefined) {
        setBalance(data.balance ?? data.credits ?? "—");
        if (data.prices) setPricing(data.prices);
      }
    } catch {
      setBalance("—");
    }
  };

  useEffect(() => {
    fetchBalance();
  }, []);

  // Расчет стоимости
  useEffect(() => {
    if (!pricing) {
      if (mode === "image") {
        setCost(imageModel === "seedream50pro" ? 2 : 1);
      } else {
        const sec = Number(duration);
        let r = videoModel === "grokimaginevideo" ? 5 : (videoModel === "klingv3turbo" ? 10 : 7);
        setCost(Math.round(sec * r * (withAudio ? 1.33 : 1)));
      }
      return;
    }

    if (mode === "image") {
      const imgCost = pricing.perImage?.[imageModel] || 2;
      setCost(imgCost);
    } else {
      const sec = Number(duration);
      let rate = pricing.perSecond?.[`${videoModel}:${quality}`] || pricing.perSecond?.[videoModel] || 7;
      let total = sec * rate;
      if (withAudio) {
        total = Math.round(total * (1 + (pricing.audioExtra || 0.33)));
      }
      setCost(total);
    }
  }, [mode, videoModel, imageModel, duration, quality, withAudio, pricing]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewRefUrl(reader.result);
        setReferenceUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const pollStatus = (inferenceId) => {
    setStatusText("Нейросеть рендерит видео... (~1-3 мин)");
    let attempts = 0;
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 150) {
        clearInterval(pollTimerRef.current);
        setError("Таймаут: превышено время ожидания.");
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/status?id=${inferenceId}&t=${Date.now()}`);
        if (!res.ok) {
          setStatusText(`Рендеринг видео... (${Math.round(attempts * 2.5)}с)`);
          return;
        }
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
            setError("Видео готово, но ссылка не найдена.");
          }
          setLoading(false);
          fetchBalance();
        } else if (st === "FAILED" || st === "ERROR") {
          clearInterval(pollTimerRef.current);
          setError(data.error || "Генерация отклонена сервером.");
          setLoading(false);
        } else {
          setStatusText(`Рендеринг видео... (${Math.round(attempts * 2.5)}с)`);
        }
      } catch {
        setStatusText(`Рендеринг видео... (${Math.round(attempts * 2.5)}с)`);
      }
    }, 2500);
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResultUrl("");
    setStatusText("Отправка запроса...");

    const isVideo = mode === "video";
    const currentMode = isVideo 
      ? (referenceUrl ? "i2v" : "t2v") 
      : (referenceUrl ? "i2i" : "t2i");

    const payload = {
      key: password || "SEED",
      mode: currentMode,
      prompt: prompt,
      model: isVideo ? videoModel : imageModel,
      ratio: aspectRatio,
      quality: quality,
      seconds: Number(duration),
      audio: withAudio,
      referenceUrl: referenceUrl || null
    };

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok || data.ok === false) {
        throw new Error(data.error || data.reason || "Ошибка генерации");
      }

      if (!isVideo && data.url) {
        setResultUrl(data.url);
        setResultType("image");
        setLoading(false);
        fetchBalance();
        return;
      }

      const inferenceId = data.inference_id || data.id || data.data?.id;
      if (inferenceId) {
        pollStatus(inferenceId);
      } else {
        throw new Error("Не получен ID задачи.");
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: "760px", margin: "30px auto", padding: "24px", fontFamily: "sans-serif", background: "#111", color: "#fff", borderRadius: "12px" }}>
      {/* Шапка */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ margin: 0, fontSize: "20px" }}>AI Media Studio (GenAI Hub)</h2>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div style={{ background: "#1c1e24", padding: "6px 12px", borderRadius: "20px", border: "1px solid #333", fontSize: "13px" }}>
            Расход: {cost} кр.
          </div>
          <div style={{ background: "#1c1e24", padding: "6px 12px", borderRadius: "20px", border: "1px solid #333", fontSize: "13px" }}>
            ⚡ Баланс: {balance}
          </div>
        </div>
      </div>

      {/* Переключатель режимов */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <button
          type="button"
          onClick={() => setMode("video")}
          style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: mode === "video" ? "#4f46e5" : "#222", color: "#fff", cursor: "pointer" }}
        >
          🎬 Видео
        </button>
        <button
          type="button"
          onClick={() => setMode("image")}
          style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: mode === "image" ? "#4f46e5" : "#222", color: "#fff", cursor: "pointer" }}
        >
          🖼 Картинка
        </button>
      </div>

      <form onSubmit={handleGenerate} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div>
          <label style={{ fontSize: "12px", color: "#aaa" }}>Код доступа (пароль к сайту):</label>
          <input
            type="password"
            placeholder="SEED"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: "10px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
          />
        </div>

        <div>
          <label style={{ fontSize: "12px", color: "#aaa" }}>Промпт:</label>
          <textarea
            placeholder="Опишите сцену..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            required
            rows={3}
            style={{ width: "100%", padding: "10px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
          />
        </div>

        {/* Блок референса */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {previewRefUrl && (
              <div style={{ width: "54px", height: "54px", borderRadius: "8px", overflow: "hidden", border: "1px solid #4f46e5", position: "relative", flexShrink: 0 }}>
                <img src={previewRefUrl} alt="ref" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: "12px", color: "#aaa" }}>Референс с ПК:</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ width: "100%", marginTop: "4px", fontSize: "12px", color: "#ccc" }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: "12px", color: "#aaa" }}>Или прямая ссылка на фото:</label>
            <input
              type="url"
              placeholder="https://.../photo.jpg"
              value={referenceUrl.startsWith("http") ? referenceUrl : ""}
              onChange={(e) => {
                setReferenceUrl(e.target.value);
                setPreviewRefUrl(e.target.value);
              }}
              style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
            />
          </div>
        </div>

        {/* Настройки параметров */}
        <div style={{ display: "grid", gridTemplateColumns: mode === "video" ? "1.3fr 1fr 1fr 1fr" : "1.5fr 1fr", gap: "8px" }}>
          <div>
            <label style={{ fontSize: "12px", color: "#aaa" }}>Модель:</label>
            {mode === "video" ? (
              <select
                value={videoModel}
                onChange={(e) => setVideoModel(e.target.value)}
                style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}
              >
                <option value="seedance25">✨ Seedance 2.5 (7 кр/с)</option>
                <option value="grokimaginevideo">🧠 Grok Video (5–6 кр/с)</option>
                <option value="klingv3">🎥 Kling V3 (8 кр/с)</option>
                <option value="klingv3turbo">⚡ Kling V3 Turbo (10 кр/с)</option>
              </select>
            ) : (
              <select
                value={imageModel}
                onChange={(e) => setImageModel(e.target.value)}
                style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}
              >
                <option value="seedream50pro">✨ Seedream 5.0 Pro (2 кр.)</option>
                <option value="grokimagineimage">🧠 Grok Imagine (1 кр.)</option>
                <option value="klingv3">🎥 Kling V3 Image (1 кр.)</option>
              </select>
            )}
          </div>

          {mode === "video" && (
            <>
              <div>
                <label style={{ fontSize: "12px", color: "#aaa" }}>Длина:</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}
                >
                  <option value="5">5 сек</option>
                  <option value="10">10 сек</option>
                  <option value="15">15 сек</option>
                  <option value="20">20 сек</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "#aaa" }}>Качество:</label>
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                  style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}
                >
                  <option value="480p">480p</option>
                  <option value="720p">720p (HD)</option>
                  <option value="1080p">1080p (FHD)</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label style={{ fontSize: "12px", color: "#aaa" }}>Формат:</label>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}
            >
              <option value="16:9">16:9 (Горизонт)</option>
              <option value="9:16">9:16 (Вертикаль)</option>
              <option value="1:1">1:1 (Квадрат)</option>
              <option value="4:3">4:3</option>
              <option value="3:4">3:4</option>
              <option value="21:9">21:9 (Cinema)</option>
            </select>
          </div>
        </div>

        {mode === "video" && (
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={withAudio}
              onChange={(e) => setWithAudio(e.target.checked)}
            />
            Включить аудио (+33% к стоимости)
          </label>
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

      {/* Результат */}
      {resultUrl && (
        <div style={{ marginTop: "20px", background: "#1c1e24", padding: "16px", borderRadius: "10px", border: "1px solid #333" }}>
          <h3 style={{ marginTop: 0, fontSize: "16px" }}>Результат генерации:</h3>

          {resultType === "video" ? (
            <div>
              <div
                onClick={() => setIsModalOpen(true)}
                style={{ width: "180px", height: "100px", borderRadius: "8px", overflow: "hidden", position: "relative", cursor: "pointer", border: "1px solid #444" }}
              >
                <video src={resultUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "24px" }}>
                  ▶
                </div>
              </div>
              <div style={{ marginTop: "12px", display: "flex", gap: "15px", alignItems: "center" }}>
                <a href={resultUrl} target="_blank" rel="noreferrer" download style={{ color: "#818cf8", fontSize: "13px", textDecoration: "none" }}>
                  ⬇ Скачать видео (.mp4)
                </a>
                <button onClick={() => setIsModalOpen(true)} style={{ background: "transparent", border: "none", color: "#9ca3af", fontSize: "13px", cursor: "pointer", textDecoration: "underline" }}>
                  ⤢ Открыть в плавающем окне
                </button>
              </div>
            </div>
          ) : (
            <div>
              <img src={resultUrl} alt="Generated" style={{ maxWidth: "300px", borderRadius: "8px" }} />
              <div style={{ marginTop: "10px" }}>
                <a href={resultUrl} target="_blank" rel="noreferrer" download style={{ color: "#818cf8", fontSize: "13px", textDecoration: "none" }}>
                  ⬇ Скачать изображение
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Модальное окно */}
      {isModalOpen && resultUrl && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
          <div style={{ background: "#16181f", borderRadius: "12px", border: "1px solid #282c37", maxWidth: "800px", width: "100%", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #282c37" }}>
              <span style={{ fontSize: "14px", fontWeight: "bold" }}>Просмотр видео</span>
              <button onClick={() => setIsModalOpen(false)} style={{ background: "transparent", border: "none", color: "#fff", fontSize: "16px", cursor: "pointer" }}>
                ✕
              </button>
            </div>
            <div style={{ background: "#000" }}>
              <video key={resultUrl} src={resultUrl} controls autoPlay loop playsInline style={{ width: "100%", maxHeight: "70vh", display: "block" }} />
            </div>
            <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <a href={resultUrl} target="_blank" rel="noreferrer" download style={{ background: "#4f46e5", color: "#fff", textDecoration: "none", padding: "8px 14px", borderRadius: "6px", fontSize: "13px" }}>
                ⬇ Скачать (.mp4)
              </a>
              <button onClick={() => setIsModalOpen(false)} style={{ background: "#222", color: "#ccc", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
