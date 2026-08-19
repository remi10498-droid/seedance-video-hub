"use client";
import React, { useState, useEffect, useRef } from "react";
import { Play, X, Download, ExternalLink, RefreshCw } from "lucide-react";

export default function Home() {
  const [mode, setMode] = useState("video");
  const [password, setPassword] = useState("");
  const [prompt, setPrompt] = useState("");

  // Настройки Видео
  const [videoModel, setVideoModel] = useState("seedance-2.5");
  const [duration, setDuration] = useState("20");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [quality, setQuality] = useState("720p");
  const [withAudio, setWithAudio] = useState(false);

  // Референсы
  const [imageFile, setImageFile] = useState(null);
  const [previewRefUrl, setPreviewRefUrl] = useState(null);
  const [imageUrl, setImageUrl] = useState("");

  // Настройки Картинок
  const [imageModel, setImageModel] = useState("flux-pro");
  const [imageSize, setImageSize] = useState("1024x1024");

  // Статусы
  const [balance, setBalance] = useState("...");
  const [cost, setCost] = useState(140);
  const [statusText, setStatusText] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState("");
  const [resultType, setResultType] = useState("");
  const [error, setError] = useState("");

  // Состояние плавающего модального окна плеера
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fileInputRef = useRef(null);
  const pollTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // Расчёт стоимости (35 кр. за каждые 5 сек)
  useEffect(() => {
    if (mode === "image") {
      let imgCost = 2;
      if (imageModel === "flux-pro") imgCost = 4;
      else if (imageModel === "dall-e-3") imgCost = 5;
      else if (imageModel === "recraft-v4") imgCost = 3;
      setCost(imgCost);
    } else {
      const d = Number(duration);
      let blocks = Math.ceil(d / 5);
      let total = blocks * 35; // 20 сек = 140 кр.
      if (videoModel === "grok-video" || videoModel === "veo-3.1") total += 20;
      if (quality === "1080p") total = Math.round(total * 1.2);
      if (withAudio) total += 10;
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

  // Локальный предпросмотр файла
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setPreviewRefUrl(URL.createObjectURL(file));
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
        setError("Таймаут: время генерации превысило лимит ожидания.");
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
            setError("Видео сгенерировано, но ссылка не найдена.");
          }
          setLoading(false);
          fetchBalance();
        } else if (st === "FAILED" || st === "ERROR") {
          clearInterval(pollTimerRef.current);
          setError(data.error || "Генерация завершилась ошибкой.");
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
    setStatusText("Отправка запроса в Picsart...");

    const formData = new FormData();
    formData.append("mode", mode);
    formData.append("password", password || "SEED");
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
      if (imageFile) formData.append("image_file", imageFile);
      else if (imageUrl) formData.append("image_url", imageUrl);
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
      } else {
        throw new Error("Не получен ID задачи.");
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: "760px", margin: "30px auto", padding: "24px", fontFamily: "sans-serif", background: "#121318", color: "#eee", borderRadius: "12px", position: "relative" }}>
      
      {/* Шапка со стоимостью и балансом */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
        <h2 style={{ margin: 0, fontSize: "20px" }}>AI Media Studio (Seedance / Kling / Wan)</h2>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div style={{ background: "#1c1e24", padding: "6px 12px", borderRadius: "20px", border: "1px solid #333", fontSize: "13px", color: "#fbbf24" }}>
            Расход: {cost} кр.
          </div>
          <div style={{ background: "#1c1e24", padding: "6px 12px", borderRadius: "20px", border: "1px solid #333", fontSize: "13px", color: "#818cf8" }}>
            ⚡ Баланс: {balance}
          </div>
        </div>
      </div>

      {/* Переключатель режимов */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <button
          type="button"
          onClick={() => setMode("video")}
          style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: mode === "video" ? "#4f46e5" : "#222", color: "#fff", cursor: "pointer", fontWeight: "bold" }}
        >
          🎬 Видео (Seedance / Kling / Wan)
        </button>
        <button
          type="button"
          onClick={() => setMode("image")}
          style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: mode === "image" ? "#4f46e5" : "#222", color: "#fff", cursor: "pointer", fontWeight: "bold" }}
        >
          🖼 Картинки (Flux / SDXL)
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
            required
            style={{ width: "100%", padding: "10px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
          />
        </div>

        <div>
          <label style={{ fontSize: "12px", color: "#aaa" }}>
            {mode === "video" ? "Промпт (описание сцены, ракурса и движений):" : "Промпт для изображения:"}
          </label>
          <textarea
            placeholder="Опишите сцену..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            required
            rows={3}
            style={{ width: "100%", padding: "10px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
          />
        </div>

        {mode === "video" ? (
          <>
            {/* Выбор референса с предпросмотром как на скриншоте */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {previewRefUrl && (
                  <div style={{ width: "54px", height: "54px", borderRadius: "8px", overflow: "hidden", border: "1px solid #4f46e5", position: "relative", flexShrink: 0 }}>
                    <img src={previewRefUrl} alt="ref" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <span style={{ position: "absolute", bottom: "1px", left: "1px", fontSize: "8px", background: "rgba(0,0,0,0.8)", padding: "1px 2px", borderRadius: "2px" }}>{aspectRatio}</span>
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "12px", color: "#aaa" }}>Фото-референс с ПК:</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ width: "100%", marginTop: "4px", fontSize: "12px", color: "#ccc" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "#aaa" }}>Или ссылка на фото:</label>
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
                  <option value="seedance-2.5">✨ Seedance 2.5</option>
                  <option value="kling-v3-pro">🎥 Kling V3.0 Pro</option>
                  <option value="wan-2.7">⚡ Wan 2.7</option>
                  <option value="grok-video">🧠 Grok Imagine</option>
                  <option value="veo-3.1">🎬 Google Veo 3.1</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "#aaa" }}>Длительность:</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}
                >
                  <option value="5">5 сек (35 кр.)</option>
                  <option value="10">10 сек (70 кр.)</option>
                  <option value="15">15 сек (105 кр.)</option>
                  <option value="20">20 сек (140 кр.)</option>
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

              <div>
                <label style={{ fontSize: "12px", color: "#aaa" }}>Формат:</label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}
                >
                  <option value="16:9">16:9 (Горизонтальный)</option>
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
              Включить синтез звука (+10 кр.)
            </label>
          </>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div>
              <label style={{ fontSize: "12px", color: "#aaa" }}>Модель картинок:</label>
              <select
                value={imageModel}
                onChange={(e) => setImageModel(e.target.value)}
                style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}
              >
                <option value="flux-pro">FLUX.1 Pro (4 кр.)</option>
                <option value="sdxl">SDXL (2 кр.)</option>
                <option value="recraft-v4">Recraft V4 (3 кр.)</option>
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

      {/* Предпросмотр сгенерированного видео / картинки */}
      {resultUrl && (
        <div style={{ marginTop: "20px", background: "#1c1e24", padding: "16px", borderRadius: "10px", border: "1px solid #282c37" }}>
          <h3 style={{ marginTop: 0, fontSize: "16px" }}>Результат генерации:</h3>
          
          {resultType === "video" ? (
            <div>
              {/* Кликабельное мини-превью как у автора */}
              <div 
                onClick={() => setIsModalOpen(true)}
                style={{ width: "180px", height: "100px", borderRadius: "8px", overflow: "hidden", position: "relative", cursor: "pointer", border: "2px solid #6366f1", background: "#000" }}
              >
                <video src={resultUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Play size={24} color="#fff" />
                </div>
                <span style={{ position: "absolute", bottom: "4px", right: "4px", fontSize: "10px", background: "rgba(0,0,0,0.8)", padding: "1px 4px", borderRadius: "3px" }}>20s</span>
              </div>

              <div style={{ marginTop: "12px", display: "flex", gap: "15px" }}>
                <a href={resultUrl} target="_blank" rel="noreferrer" download style={{ color: "#818cf8", fontSize: "13px", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}>
                  <Download size={14} /> Скачать видео (.mp4)
                </a>
                <button onClick={() => setIsModalOpen(true)} style={{ background: "transparent", border: "none", color: "#9ca3af", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                  <ExternalLink size={14} /> Открыть в окне
                </button>
              </div>
            </div>
          ) : (
            <div>
              <img src={resultUrl} alt="Generated" style={{ maxWidth: "300px", borderRadius: "8px" }} />
              <div style={{ marginTop: "10px" }}>
                <a href={resultUrl} target="_blank" rel="noreferrer" download style={{ color: "#818cf8", fontSize: "13px" }}>⬇ Скачать изображение</a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ПЛАВАЮЩЕЕ ОКНО (POPUP ПЛЕЕР) ВНУТРИ САЙТА */}
      {isModalOpen && resultUrl && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
          <div style={{ background: "#16181f", borderRadius: "12px", border: "1px solid #282c37", maxWidth: "800px", width: "100%", overflow: "hidden", position: "relative", boxShadow: "0 20px 50px rgba(0,0,0,0.8)" }}>
            
            {/* Шапка окна */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #282c37" }}>
              <span style={{ fontSize: "14px", fontWeight: "bold" }}>Просмотр видео (Seedance 2.5 • 20s)</span>
              <button onClick={() => setIsModalOpen(false)} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            {/* Плеер */}
            <div style={{ background: "#000" }}>
              <video key={resultUrl} src={resultUrl} controls autoPlay loop playsInline style={{ width: "100%", maxHeight: "70vh", display: "block" }} />
            </div>

            {/* Подвал окна с кнопкой скачать */}
            <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <a href={resultUrl} target="_blank" rel="noreferrer" download style={{ background: "#4f46e5", color: "#fff", padding: "8px 16px", borderRadius: "6px", textDecoration: "none", fontSize: "13px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px" }}>
                <Download size={15} /> Скачать (.mp4)
              </a>
              <button onClick={() => setIsModalOpen(false)} style={{ background: "#222", color: "#ccc", border: "none", padding: "8px 16px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>
                Закрыть
              </button>
            </div>

          </div>
        </div>
      )}

    </main>
  );
}
