"use client";
import React, { useState, useEffect, useRef } from "react";

export default function Home() {
  const [mode, setMode] = useState("video"); // "video" | "image"
  const [password, setPassword] = useState("");
  const [prompt, setPrompt] = useState("");
  
  // Честные настройки видео
  const [videoModel, setVideoModel] = useState("seedance-2.5");
  const [duration, setDuration] = useState("5");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [quality, setQuality] = useState("720p");
  const [withAudio, setWithAudio] = useState(false);
  const [firstFrameUrl, setFirstFrameUrl] = useState("");
  const [lastFrameUrl, setLastFrameUrl] = useState("");

  // Честные настройки картинок
  const [imageModel, setImageModel] = useState("picsart-genai-image");
  const [imageSize, setImageSize] = useState("1024x1024");

  // Статусы
  const [balance, setBalance] = useState("Загрузка...");
  const [cost, setCost] = useState(5);
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

  // ТОЧНЫЙ РАСЧЕТ СТОИМОСТИ (КАК СПИСЫВАЕТ PICSART)
  useEffect(() => {
    if (mode === "image") {
      // 1 кр. за 1K (1024/1280), 2 кр. за 2K (2048)
      const is2K = imageSize.includes("2048");
      setCost(is2K ? 2 : 1);
    } else {
      // 1 сек = 1 кр. (в 720p)
      const sec = Number(duration) || 5;
      let qMult = 1;
      if (quality === "480p") qMult = 0.8;
      if (quality === "1080p") qMult = 1.6;

      // Аудио добавляет ровно +2 кредита
      const audioExtra = withAudio ? 2 : 0;

      const totalCost = Math.round(sec * qMult) + audioExtra;
      setCost(totalCost);
    }
  }, [mode, duration, quality, withAudio, imageSize]);

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
        setError("Таймаут генерации.");
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
            setResultType("video");
            setStatusText("Готово!");
          } else {
            setError("Результат готов, но ссылка отсутствует.");
          }
          setLoading(false);
          // Обновляем реальный баланс сразу после генерации
          setTimeout(fetchBalance, 1500);
        } else if (st === "FAILED" || st === "ERROR") {
          clearInterval(pollTimerRef.current);
          setError(data.error || "Генерация отклонена сервером.");
          setLoading(false);
        } else {
          setStatusText(`Рендеринг... (${Math.round(attempts * 2.5)}с)`);
        }
      } catch {
        clearInterval(pollTimerRef.current);
        setError("Ошибка проверки статуса.");
        setLoading(false);
      }
    }, 2500);
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResultUrl("");
    setStatusText("Отправка запроса...");

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
      if (firstFrameUrl) formData.append("first_frame_url", firstFrameUrl);
      if (lastFrameUrl) formData.append("last_frame_url", lastFrameUrl);
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
    <main style={{ maxWidth: "760px", margin: "30px auto", padding: "24px", fontFamily: "sans-serif", background: "#121318", color: "#eee", borderRadius: "12px", boxShadow: "0 8px 30px rgba(0,0,0,0.5)" }}>
      {/* Шапка */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
        <h2 style={{ margin: 0, fontSize: "20px" }}>Picsart Enterprise Studio</h2>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div style={{ background: "#1c1e24", padding: "6px 12px", borderRadius: "20px", border: "1px solid #333", fontSize: "13px", color: "#fbbf24" }}>
            🪙 Расход: {cost} кр.
          </div>
          <div style={{ background: "#1c1e24", padding: "6px 12px", borderRadius: "20px", border: "1px solid #333", fontSize: "13px", fontWeight: "bold", color: "#818cf8" }}>
            ⚡ Баланс: {balance}
          </div>
        </div>
      </div>

      {/* Переключатель: Видео / Картинка */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", background: "#1a1b22", padding: "4px", borderRadius: "8px", width: "fit-content" }}>
        <button
          type="button"
          onClick={() => setMode("video")}
          style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: mode === "video" ? "#4f46e5" : "transparent", color: "#fff", cursor: "pointer", fontWeight: "bold" }}
        >
          🎬 Генерация видео
        </button>
        <button
          type="button"
          onClick={() => setMode("image")}
          style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: mode === "image" ? "#4f46e5" : "transparent", color: "#fff", cursor: "pointer", fontWeight: "bold" }}
        >
          🖼 Генерация картинок (до 2K)
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
            placeholder="Опишите детально, что сгенерировать..."
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ fontSize: "12px", color: "#aaa" }}>Начальный кадр (URL фото):</label>
                <input
                  type="url"
                  placeholder="https://.../start.jpg"
                  value={firstFrameUrl}
                  onChange={(e) => setFirstFrameUrl(e.target.value)}
                  style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", color: "#aaa" }}>Конечный кадр (URL фото):</label>
                <input
                  type="url"
                  placeholder="https://.../end.jpg"
                  value={lastFrameUrl}
                  onChange={(e) => setLastFrameUrl(e.target.value)}
                  style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: "8px" }}>
              <div>
                <label style={{ fontSize: "12px", color: "#aaa" }}>Движок видео:</label>
                <select
                  value={videoModel}
                  onChange={(e) => setVideoModel(e.target.value)}
                  style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
                >
                  <option value="seedance-2.5">✨ Seedance 2.5 (High Quality)</option>
                  <option value="seedance-2.0">🎬 Seedance 2.0 (Fast Gen)</option>
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
              🔊 Включить звуковое сопровождение (+2 кр.)
            </label>
          </>
        )}

        {/* НАСТРОЙКИ КАРТИНОК */}
        {mode === "image" && (
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "10px" }}>
            <div>
              <label style={{ fontSize: "12px", color: "#aaa" }}>Движок генерации:</label>
              <select
                value={imageModel}
                onChange={(e) => setImageModel(e.target.value)}
                style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
              >
                <option value="picsart-genai-image">🎨 Picsart GenAI Image Engine</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: "12px", color: "#aaa" }}>Разрешение:</label>
              <select
                value={imageSize}
                onChange={(e) => setImageSize(e.target.value)}
                style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
              >
                <option value="1024x1024">1:1 (1024x1024) — 1 кр.</option>
                <option value="1280x720">16:9 (1280x720) — 1 кр.</option>
                <option value="720x1280">9:16 (720x1280) — 1 кр.</option>
                <option value="2048x2048">🌟 1:1 2K (2048x2048) — 2 кр.</option>
                <option value="2048x1152">🌟 16:9 2K (2048x1152) — 2 кр.</option>
                <option value="1152x2048">🌟 9:16 2K (1152x2048) — 2 кр.</option>
              </select>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{ marginTop: "10px", padding: "12px", background: loading ? "#444" : "#4f46e5", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading ? statusText : `Сгенерировать (${mode === "video" ? "Видео" : "Картинку"} — ${cost} кр.)`}
        </button>
      </form>

      {error && <p style={{ color: "#f87171", marginTop: "15px", background: "#2b1517", padding: "10px", borderRadius: "6px" }}>{error}</p>}

      {/* Результат */}
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
