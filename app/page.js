"use client";

import React, { useState, useEffect, useRef } from "react";

const MODEL_SPECS = {
  "seedance-2.5": {
    durations: ["4", "5", "6", "7", "8", "10", "15", "20"],
    resolutions: [
      { id: "480p", label: "480p" },
      { id: "720p", label: "720p (HD)" },
      { id: "1080p", label: "1080p (FHD)" },
    ],
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
    hasAudio: true,
  },
  "seedance-2.0": {
    durations: ["4", "5", "6", "7", "8", "10", "12", "15"],
    resolutions: [
      { id: "480p", label: "480p" },
      { id: "720p", label: "720p (HD)" },
      { id: "1080p", label: "1080p (FHD)" },
    ],
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
    hasAudio: true,
  },
  "flux-3-video": {
    durations: ["5", "10", "15", "20"],
    resolutions: [
      { id: "720p", label: "HD (720p)" },
      { id: "1080p", label: "FHD (1080p)" },
    ],
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
    hasAudio: true,
  },
  "kling-v3-pro": {
    durations: ["5", "10"],
    resolutions: [
      { id: "720p", label: "720p (HD)" },
      { id: "1080p", label: "1080p (FHD)" },
    ],
    ratios: ["16:9", "9:16", "1:1"],
    hasAudio: false,
  },
  "wan-3.0-video": {
    durations: ["5", "10", "15"],
    resolutions: [
      { id: "480p", label: "480P" },
      { id: "720p", label: "720P (HD)" },
      { id: "1080p", label: "1080P (FHD)" },
    ],
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    hasAudio: true,
  },
  "flux-2-pro": {
    durations: [],
    resolutions: [
      { id: "1024x1024", label: "1K Standard" },
      { id: "2048x2048", label: "2K Ultra HD" },
    ],
    ratios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    isImage: true,
  },
};

export default function MediaStudio() {
  const [accessCode, setAccessCode] = useState("SEED480");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("seedance-2.5");
  const [duration, setDuration] = useState("10");
  const [resolution, setResolution] = useState("720p");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [generateAudio, setGenerateAudio] = useState(false);

  const [startFrameUrl, setStartFrameUrl] = useState("");
  const [endFrameUrl, setEndFrameUrl] = useState("");
  const [uploadingStart, setUploadingStart] = useState(false);
  const [uploadingEnd, setUploadingEnd] = useState(false);

  const [balance, setBalance] = useState("...");
  const [cost, setCost] = useState(35);
  const [statusText, setStatusText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const [history, setHistory] = useState([]);
  const [activeMedia, setActiveMedia] = useState(null);

  const pollTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const savedPassword = localStorage.getItem("ai_access_password");
    if (savedPassword) setAccessCode(savedPassword);
    const savedHistory = localStorage.getItem("ai_hub_history_verified_duration");
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch {}
    }
  }, []);

  const handlePasswordChange = (e) => {
    const val = e.target.value;
    setAccessCode(val);
    localStorage.setItem("ai_access_password", val);
  };

  const saveHistory = (items) => {
    setHistory(items);
    localStorage.setItem("ai_hub_history_verified_duration", JSON.stringify(items));
  };

  const currentSpec = MODEL_SPECS[model] || MODEL_SPECS["seedance-2.5"];

  useEffect(() => {
    const spec = MODEL_SPECS[model];
    if (!spec) return;
    if (spec.durations.length > 0 && !spec.durations.includes(duration)) setDuration(spec.durations[0]);
    if (spec.resolutions.length > 0 && !spec.resolutions.some((r) => r.id === resolution)) setResolution(spec.resolutions[0].id);
    if (spec.ratios.length > 0 && !spec.ratios.includes(aspectRatio)) setAspectRatio(spec.ratios[0]);
  }, [model]);

  // Расчёт стоимости с учётом разрешения
  useEffect(() => {
    if (currentSpec.isImage) {
      setCost(resolution.includes("2048") ? 4 : 2);
    } else {
      const sec = Number(duration) || 5;
      let rate = 7;
      if (model === "flux-3-video") rate = 5;
      else if (model === "kling-v3-pro") rate = 3;
      else if (model === "wan-3.0-video") rate = 7;

      let qMult = 1.0;
      if (resolution === "480p") qMult = 0.7;
      if (resolution === "1080p") qMult = 1.4;

      let total = Math.round(sec * rate * qMult);
      if (generateAudio && currentSpec.hasAudio) total = Math.round(total * 1.33);
      setCost(total);
    }
  }, [model, duration, resolution, generateAudio, currentSpec]);

  const fetchBalance = async () => {
    try {
      const res = await fetch("/api/balance?t=" + Date.now());
      const data = await res.json();
      if (data.balance || data.credits !== undefined) setBalance(data.balance || `${data.credits} кр.`);
    } catch {
      setBalance("—");
    }
  };

  useEffect(() => {
    fetchBalance();
  }, []);

  const uploadToBlob = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Ошибка загрузки");
    return data.url;
  };

  const handleStartUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingStart(true);
    setError("");
    try {
      const url = await uploadToBlob(file);
      setStartFrameUrl(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingStart(false);
    }
  };

  const handleEndUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingEnd(true);
    setError("");
    try {
      const url = await uploadToBlob(file);
      setEndFrameUrl(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingEnd(false);
    }
  };

  const pollStatus = (taskId, itemMeta) => {
    setStatusText("Нейросеть рендерит видео... (~1-2 мин)");
    let attempts = 0;
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 140) {
        clearInterval(pollTimerRef.current);
        setError("Таймаут: генерация длится слишком долго.");
        setGenerating(false);
        return;
      }
      try {
        const res = await fetch(`/api/status?id=${taskId}&t=${Date.now()}`);
        const data = await res.json();
        if (data.status === "DONE" && data.url) {
          clearInterval(pollTimerRef.current);

          // Проверка РЕАЛЬНОГО хронометража ролика перед записью в историю
          const tempVideo = document.createElement("video");
          tempVideo.src = data.url;
          tempVideo.onloadedmetadata = () => {
            const actualSeconds = Math.round(tempVideo.duration) || 5;
            const newItem = {
              id: taskId || Date.now().toString(),
              url: data.url,
              prompt: itemMeta.prompt,
              model: itemMeta.model,
              duration: actualSeconds,
              cost: itemMeta.cost,
              isImage: itemMeta.isImage,
              date: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            };
            saveHistory([newItem, ...history]);
            setStatusText("Готово!");
            setGenerating(false);
            fetchBalance();
          };
          tempVideo.onerror = () => {
            const newItem = {
              id: taskId || Date.now().toString(),
              url: data.url,
              prompt: itemMeta.prompt,
              model: itemMeta.model,
              duration: 5,
              cost: itemMeta.cost,
              isImage: itemMeta.isImage,
              date: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            };
            saveHistory([newItem, ...history]);
            setStatusText("Готово!");
            setGenerating(false);
            fetchBalance();
          };
        } else if (data.status === "FAILED") {
          clearInterval(pollTimerRef.current);
          setError(data.error || "Генерация отклонена сервисом Picsart.");
          setGenerating(false);
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
    if (!prompt.trim()) {
      setError("Пожалуйста, заполните поле промпта");
      return;
    }

    setGenerating(true);
    setError("");
    setStatusText("Отправка запроса в Picsart API...");

    const formData = new FormData();
    formData.append("password", accessCode || "SEED480");
    formData.append("prompt", prompt);
    formData.append("model", model);
    formData.append("mode", currentSpec.isImage ? "image" : "video");
    formData.append("duration", duration);
    formData.append("length", duration);
    formData.append("resolution", resolution);
    formData.append("quality", resolution);
    formData.append("aspect_ratio", aspectRatio);
    formData.append("with_audio", String(generateAudio));
    if (startFrameUrl) formData.append("start_frame", startFrameUrl);
    if (endFrameUrl) formData.append("end_frame", endFrameUrl);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Ошибка запуска генерации");
      }

      if (currentSpec.isImage && data.url) {
        const newItem = {
          id: Date.now().toString(),
          url: data.url,
          prompt,
          model,
          cost,
          isImage: true,
          date: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        saveHistory([newItem, ...history]);
        setGenerating(false);
        fetchBalance();
        return;
      }

      const taskId = data.inference_id || data.id || data.data?.id;
      if (taskId) {
        pollStatus(taskId, { prompt, model, duration: Number(duration), cost, isImage: false });
      } else {
        throw new Error("Не получен ID задачи.");
      }
    } catch (err) {
      setError(err.message);
      setGenerating(false);
    }
  };

  const deleteItem = (id, e) => {
    e.stopPropagation();
    const updated = history.filter((item) => item.id !== id);
    saveHistory(updated);
  };

  return (
    <main style={{ maxWidth: "860px", margin: "30px auto", padding: "24px", fontFamily: "sans-serif", background: "#111", color: "#fff", borderRadius: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ margin: 0, fontSize: "20px" }}>AI Media Studio (GenAI Hub)</h2>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div style={{ background: "#1c1e24", padding: "6px 12px", borderRadius: "20px", border: "1px solid #333", fontSize: "13px" }}>
            Расход: ~{cost} кр.
          </div>
          <div style={{ background: "#1c1e24", padding: "6px 12px", borderRadius: "20px", border: "1px solid #333", fontSize: "13px", color: "#818cf8", fontWeight: "bold" }}>
            ⚡ Баланс: {balance}
          </div>
        </div>
      </div>

      <form onSubmit={handleGenerate} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div>
          <label style={{ fontSize: "12px", color: "#aaa" }}>Код доступа к сайту (сохраняется автоматически):</label>
          <input
            type="password"
            placeholder="SEED480"
            value={accessCode}
            onChange={handlePasswordChange}
            style={{ width: "100%", padding: "10px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
          />
        </div>

        <div>
          <label style={{ fontSize: "12px", color: "#aaa" }}>Текстовый промпт:</label>
          <textarea
            placeholder="Опишите сцену детально..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            required
            style={{ width: "100%", padding: "10px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ background: "#181a20", padding: "14px", borderRadius: "8px", border: "1px solid #282c37" }}>
          <p style={{ margin: "0 0 10px 0", fontSize: "13px", fontWeight: "bold", color: "#ddd" }}>
            Референсы / Кадры
          </p>
          <div style={{ display: "grid", gridTemplateColumns: currentSpec.isImage ? "1fr" : "1fr 1fr", gap: "14px" }}>
            <div>
              <label style={{ fontSize: "12px", color: "#aaa", display: "block", marginBottom: "4px" }}>
                1. Начальный кадр / Фото: {uploadingStart && "⏳ Загрузка..."}
              </label>
              <input type="file" accept="image/*" onChange={handleStartUpload} style={{ fontSize: "12px", color: "#ccc" }} />
              {startFrameUrl && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
                  <img src={startFrameUrl} alt="start" style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "4px" }} />
                  <span style={{ fontSize: "11px", color: "#10b981" }}>✓ В облаке</span>
                  <button type="button" onClick={() => setStartFrameUrl("")} style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", fontSize: "11px" }}>Удалить</button>
                </div>
              )}
            </div>

            {!currentSpec.isImage && (
              <div>
                <label style={{ fontSize: "12px", color: "#aaa", display: "block", marginBottom: "4px" }}>
                  2. Финальный кадр (Морфинг): {uploadingEnd && "⏳ Загрузка..."}
                </label>
                <input type="file" accept="image/*" onChange={handleEndUpload} style={{ fontSize: "12px", color: "#ccc" }} />
                {endFrameUrl && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
                    <img src={endFrameUrl} alt="end" style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "4px" }} />
                    <span style={{ fontSize: "11px", color: "#10b981" }}>✓ В облаке</span>
                    <button type="button" onClick={() => setEndFrameUrl("")} style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", fontSize: "11px" }}>Удалить</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "8px" }}>
          <div>
            <label style={{ fontSize: "12px", color: "#aaa" }}>Модель:</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}
            >
              <option value="seedance-2.5">✨ Seedance 2.5</option>
              <option value="seedance-2.0">✨ Seedance 2.0</option>
              <option value="flux-3-video">🔥 Flux 3 Video</option>
              <option value="kling-v3-pro">🎥 Kling V3 Pro</option>
              <option value="wan-3.0-video">⚡ Wan 3.0 Video</option>
              <option value="flux-2-pro">🎨 FLUX.2 Pro (Картинка)</option>
            </select>
          </div>

          {currentSpec.durations.length > 0 && (
            <div>
              <label style={{ fontSize: "12px", color: "#aaa" }}>Длина:</label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}
              >
                {currentSpec.durations.map((d) => (
                  <option key={d} value={d}>{`${d} сек`}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={{ fontSize: "12px", color: "#aaa" }}>Качество:</label>
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}
            >
              {currentSpec.resolutions.map((res) => (
                <option key={res.id} value={res.id}>{res.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: "12px", color: "#aaa" }}>Формат:</label>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}
            >
              {currentSpec.ratios.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>

        {currentSpec.hasAudio && (
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
            <input type="checkbox" checked={generateAudio} onChange={(e) => setGenerateAudio(e.target.checked)} />
            Включить аудио (+33% к стоимости)
          </label>
        )}

        <button
          type="submit"
          disabled={generating || uploadingStart || uploadingEnd}
          style={{ marginTop: "8px", padding: "12px", background: generating ? "#444" : "#4f46e5", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: generating ? "not-allowed" : "pointer" }}
        >
          {generating ? statusText : `Сгенерировать (~${cost} кр.)`}
        </button>
      </form>

      {error && (
        <p style={{ color: "#f87171", marginTop: "15px", background: "#2b1517", padding: "10px", borderRadius: "6px", fontSize: "13px" }}>
          {error}
        </p>
      )}

      <div style={{ marginTop: "30px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #222", paddingBottom: "10px", marginBottom: "16px" }}>
          <h3 style={{ margin: 0, fontSize: "16px" }}>История генераций ({history.length})</h3>
          {history.length > 0 && (
            <button onClick={() => saveHistory([])} style={{ background: "transparent", border: "none", color: "#888", fontSize: "12px", cursor: "pointer", textDecoration: "underline" }}>
              Очистить историю
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <p style={{ color: "#666", fontSize: "13px" }}>Пока нет созданных файлов.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "16px" }}>
            {history.map((item) => (
              <div
                key={item.id}
                onClick={() => setActiveMedia(item)}
                style={{ background: "#1c1e24", borderRadius: "10px", overflow: "hidden", border: "1px solid #333", cursor: "pointer", display: "flex", flexDirection: "column" }}
              >
                <div style={{ width: "100%", height: "140px", background: "#000", position: "relative" }}>
                  {item.isImage ? (
                    <img src={item.url} alt="gen" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <>
                      <video src={item.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>
                        ▶
                      </div>
                      <span style={{ position: "absolute", bottom: "6px", right: "6px", background: "rgba(0,0,0,0.8)", fontSize: "10px", padding: "2px 6px", borderRadius: "4px" }}>
                        {item.duration || 5}с
                      </span>
                    </>
                  )}
                </div>

                <div style={{ padding: "10px 12px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <p style={{ margin: "0 0 6px 0", fontSize: "12px", color: "#ddd", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.prompt}
                  </p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "10px", color: "#777" }}>{item.date}</span>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <a href={item.url} target="_blank" rel="noreferrer" download onClick={(e) => e.stopPropagation()} style={{ color: "#818cf8", fontSize: "12px", textDecoration: "none" }}>
                        ⬇
                      </a>
                      <button type="button" onClick={(e) => deleteItem(item.id, e)} style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", fontSize: "12px" }}>
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {activeMedia && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
          <div style={{ background: "#16181f", borderRadius: "12px", border: "1px solid #282c37", maxWidth: "800px", width: "100%", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #282c37" }}>
              <span style={{ fontSize: "14px", fontWeight: "bold" }}>{activeMedia.isImage ? "Изображение" : "Видео"}</span>
              <button onClick={() => setActiveMedia(null)} style={{ background: "transparent", border: "none", color: "#fff", fontSize: "16px", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ background: "#000", textAlign: "center" }}>
              {activeMedia.isImage ? (
                <img src={activeMedia.url} alt="Full view" style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain" }} />
              ) : (
                <video key={activeMedia.url} src={activeMedia.url} controls autoPlay loop playsInline style={{ width: "100%", maxHeight: "70vh", display: "block" }} />
              )}
            </div>
            <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <a href={activeMedia.url} target="_blank" rel="noreferrer" download style={{ background: "#4f46e5", color: "#fff", textDecoration: "none", padding: "8px 14px", borderRadius: "6px", fontSize: "13px" }}>
                ⬇ Скачать файл
              </a>
              <button onClick={() => setActiveMedia(null)} style={{ background: "#222", color: "#ccc", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
