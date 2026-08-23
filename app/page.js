"use client";

import React, { useState, useEffect, useRef } from "react";

const MODEL_SPECS = {
  "seedance-2.5": {
    name: "Seedance 2.5",
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
    name: "Seedance 2.0",
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
    name: "Flux 3 Video",
    durations: ["5", "10", "15", "20"],
    resolutions: [
      { id: "720p", label: "HD (720p)" },
      { id: "1080p", label: "FHD (1080p)" },
    ],
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
    hasAudio: true,
  },
  "kling-v3-pro": {
    name: "Kling 3.0",
    durations: ["5", "10"],
    resolutions: [
      { id: "720p", label: "720p (HD)" },
      { id: "1080p", label: "1080p (FHD)" },
    ],
    ratios: ["16:9", "9:16", "1:1"],
    hasAudio: false,
  },
  "wan-3.0-video": {
    name: "Wan 3.0",
    durations: ["5", "10", "15", "20"],
    resolutions: [
      { id: "480p", label: "480P" },
      { id: "720p", label: "720P (HD)" },
      { id: "1080p", label: "1080P (FHD)" },
    ],
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    hasAudio: true,
  },
  "grok-imagine-video-1.5": {
    name: "Grok 1.5",
    durations: ["3", "5", "6", "8", "10", "12", "15"],
    resolutions: [
      { id: "720p", label: "720p (HD)" },
    ],
    ratios: ["16:9", "9:16", "1:1"],
    hasAudio: true,
    requiresImage: true,
  },
  "sora-2-pro": {
    name: "Sora 2 Pro",
    durations: ["4", "8", "12", "16", "20"],
    resolutions: [
      { id: "720p", label: "720p (HD)" },
    ],
    ratios: ["16:9", "9:16"],
    hasAudio: false,
  }
};

const MASTER_STORAGE_KEY = "picsart_permanent_genai_history_master_v2";
const LEGACY_KEYS = [
  "picsart_permanent_genai_history_master",
  "ai_hub_main_persistent_history",
  "ai_hub_history_permanent",
  "ai_hub_history_verified_specs_v3",
  "ai_hub_history_specs_v9"
];

export default function MediaStudio() {
  const [accessCode, setAccessCode] = useState("SEED480");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("seedance-2.5");
  const [duration, setDuration] = useState("10");
  const [resolution, setResolution] = useState("720p");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [generateAudio, setGenerateAudio] = useState(false);

  const [startFrameUrl, setStartFrameUrl] = useState("");
  const [uploadingStart, setUploadingStart] = useState(false);

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

  // АВТО-ВОССТАНОВЛЕНИЕ ПОТЕРЯННОЙ ИСТОРИИ
  useEffect(() => {
    try {
      const savedPassword = localStorage.getItem("ai_access_password");
      if (savedPassword) setAccessCode(savedPassword);

      let allItems = [];
      const primaryData = localStorage.getItem(MASTER_STORAGE_KEY);
      if (primaryData) {
        try {
          const parsed = JSON.parse(primaryData);
          if (Array.isArray(parsed)) allItems = parsed;
        } catch {}
      }

      LEGACY_KEYS.forEach((key) => {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
              parsed.forEach((item) => {
                if (!allItems.some((existing) => existing.id === item.id || existing.url === item.url)) {
                  allItems.push(item);
                }
              });
            }
          } catch {}
        }
      });

      if (allItems.length > 0) {
        setHistory(allItems);
        localStorage.setItem(MASTER_STORAGE_KEY, JSON.stringify(allItems));
      }
    } catch {}
  }, []);

  const handlePasswordChange = (e) => {
    const val = e.target.value;
    setAccessCode(val);
    localStorage.setItem("ai_access_password", val);
  };

  const saveHistory = (items) => {
    setHistory(items);
    try {
      localStorage.setItem(MASTER_STORAGE_KEY, JSON.stringify(items));
    } catch {}
  };

  const currentSpec = MODEL_SPECS[model] || MODEL_SPECS["seedance-2.5"];

  useEffect(() => {
    const spec = MODEL_SPECS[model];
    if (!spec) return;
    if (spec.durations.length > 0 && !spec.durations.includes(duration)) setDuration(spec.durations[0]);
    if (spec.resolutions.length > 0 && !spec.resolutions.some((r) => r.id === resolution)) setResolution(spec.resolutions[0].id);
    if (spec.ratios.length > 0 && !spec.ratios.includes(aspectRatio)) setAspectRatio(spec.ratios[0]);
  }, [model]);

  // Предварительный расчёт стоимости
  useEffect(() => {
    const sec = Number(duration) || 5;
    let rate = 7;
    if (model === "flux-3-video") rate = 8;
    else if (model === "kling-v3-pro") rate = 5;
    else if (model === "wan-3.0-video") rate = 8;
    else if (model === "sora-2-pro") rate = 15;
    else if (model === "grok-imagine-video-1.5") rate = 6;

    let qMult = 1.0;
    if (resolution === "480p") qMult = 0.7;
    if (resolution === "1080p") qMult = 1.4;

    let total = Math.round(sec * rate * qMult);
    if (generateAudio && currentSpec.hasAudio) total = Math.round(total * 1.33);
    setCost(total);
  }, [model, duration, resolution, generateAudio, currentSpec]);

  const fetchBalanceNum = async () => {
    try {
      const res = await fetch("/api/balance?t=" + Date.now());
      const data = await res.json();
      const num = Number(data.credits ?? parseInt(data.balance, 10));
      if (!isNaN(num)) return num;
    } catch {}
    return null;
  };

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

  const pollStatus = (taskId, itemMeta, startBal) => {
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
        const res = await fetch(`/api/status?id=${taskId}&model_name=${encodeURIComponent(itemMeta.modelName)}&t=${Date.now()}`);
        const data = await res.json();
        
        if (data.status === "DONE" && data.url) {
          clearInterval(pollTimerRef.current);

          const endBal = await fetchBalanceNum();
          let realCost = data.real_credits;
          if (!realCost && startBal !== null && endBal !== null && startBal > endBal) {
            realCost = startBal - endBal;
          }
          if (!realCost) realCost = itemMeta.cost;

          const tempVideo = document.createElement("video");
          tempVideo.src = data.url;
          tempVideo.onloadedmetadata = () => {
            const actualSeconds = Math.round(tempVideo.duration) || itemMeta.duration;
            const actualResolution = `${tempVideo.videoWidth}×${tempVideo.videoHeight}`;
            const finalModel = data.real_model || itemMeta.modelName;

            const newItem = {
              id: taskId || Date.now().toString(),
              url: data.url,
              prompt: itemMeta.prompt,
              model: finalModel,
              duration: actualSeconds,
              resolution: actualResolution,
              cost: realCost,
              isImage: false,
              date: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            };
            
            let currentList = [];
            try { currentList = JSON.parse(localStorage.getItem(MASTER_STORAGE_KEY)) || []; } catch {}
            saveHistory([newItem, ...currentList]);

            setStatusText("Готово!");
            setGenerating(false);
            fetchBalance();
          };
          
          tempVideo.onerror = () => {
            const newItem = {
              id: taskId || Date.now().toString(),
              url: data.url,
              prompt: itemMeta.prompt,
              model: data.real_model || itemMeta.modelName,
              duration: itemMeta.duration,
              resolution: itemMeta.resolution,
              cost: realCost,
              isImage: false,
              date: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            };
            let currentList = [];
            try { currentList = JSON.parse(localStorage.getItem(MASTER_STORAGE_KEY)) || []; } catch {}
            saveHistory([newItem, ...currentList]);

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
    if (currentSpec.requiresImage && !startFrameUrl) {
      setError(`⚠️ Для модели ${model} обязательно загрузите фото`);
      return;
    }
    if (!prompt.trim()) {
      setError("Пожалуйста, заполните поле промпта");
      return;
    }

    setGenerating(true);
    setError("");
    setStatusText("Отправка запроса в Picsart API...");

    const startBal = await fetchBalanceNum();

    const formData = new FormData();
    formData.append("password", accessCode || "SEED480");
    formData.append("prompt", prompt);
    formData.append("model", model);
    formData.append("mode", "video");
    formData.append("length", duration);
    formData.append("resolution", resolution);
    formData.append("aspectRatio", aspectRatio);
    formData.append("with_audio", String(generateAudio));
    if (startFrameUrl) formData.append("start_frame", startFrameUrl);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Ошибка запуска генерации");
      }

      const taskId = data.inference_id || data.id || data.data?.id;
      if (taskId) {
        pollStatus(taskId, { prompt, modelName: currentSpec.name, duration: Number(duration), resolution, cost, isImage: false }, startBal);
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
        <h2 style={{ margin: 0, fontSize: "20px" }}>AI Media Studio</h2>
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

        <div style={{ background: "#181a20", padding: "14px", borderRadius: "8px", border: currentSpec.requiresImage ? "1px solid #f59e0b" : "1px solid #282c37" }}>
          <label style={{ fontSize: "12px", color: currentSpec.requiresImage ? "#fbbf24" : "#aaa", display: "block", marginBottom: "4px" }}>
            {currentSpec.requiresImage ? "⚠️ Начальный кадр / Фото (Обязательно):" : "Начальный кадр (Необязательно):"} {uploadingStart && "⏳ Загрузка..."}
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
              <option value="kling-v3-pro">🎥 Kling 3.0</option>
              <option value="wan-3.0-video">⚡ Wan 3.0 Video</option>
              <option value="sora-2-pro">🌟 Sora 2 Pro</option>
              <option value="grok-imagine-video-1.5">🧠 Grok Video 1.5</option>
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
          disabled={generating || uploadingStart}
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

      {/* Галерея генераций */}
      <div style={{ marginTop: "30px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #222", paddingBottom: "10px", marginBottom: "16px" }}>
          <h3 style={{ margin: 0, fontSize: "16px" }}>История генераций ({history.length})</h3>
          {history.length > 0 && (
            <button onClick={() => { setHistory([]); localStorage.removeItem(MASTER_STORAGE_KEY); }} style={{ background: "transparent", border: "none", color: "#888", fontSize: "12px", cursor: "pointer", textDecoration: "underline" }}>
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
                  {/* Трюк с #t=0.001 заставляет браузер загрузить первый кадр видео в качестве картинки превью */}
                  <video src={`${item.url}#t=0.001`} preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline />
                  <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
                    ▶
                  </div>

                  <span style={{ position: "absolute", top: "5px", left: "5px", background: "rgba(0,0,0,0.75)", color: "#a5b4fc", fontSize: "9px", padding: "2px 6px", borderRadius: "4px" }}>
                    {item.model}
                  </span>

                  {item.resolution && (
                    <span style={{ position: "absolute", top: "5px", right: "5px", background: "rgba(0,0,0,0.75)", color: "#9ca3af", fontSize: "9px", padding: "2px 6px", borderRadius: "4px" }}>
                      {item.resolution}
                    </span>
                  )}

                  <span style={{ position: "absolute", bottom: "5px", left: "5px", background: "rgba(0,0,0,0.85)", color: "#10b981", fontSize: "9px", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold" }}>
                    💎 {item.cost} кр.
                  </span>

                  {item.duration && (
                    <span style={{ position: "absolute", bottom: "5px", right: "5px", background: "rgba(0,0,0,0.85)", color: "#fff", fontSize: "9px", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold" }}>
                      {item.duration}с
                    </span>
                  )}
                </div>

                <div style={{ padding: "8px 10px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <p style={{ margin: "0 0 6px 0", fontSize: "11px", color: "#ddd", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.prompt}
                  </p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "9px", color: "#6b7280" }}>{item.date}</span>
                    <a href={item.url} target="_blank" rel="noreferrer" download onClick={(e) => e.stopPropagation()} style={{ color: "#818cf8", fontSize: "11px", textDecoration: "none" }}>
                      ⬇
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Всплывающее окно просмотра */}
      {activeMedia && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
          <div style={{ background: "#16181f", borderRadius: "12px", border: "1px solid #282c37", maxWidth: "800px", width: "100%", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #282c37" }}>
              <span style={{ fontSize: "13px", fontWeight: "bold" }}>
                {activeMedia.model} • {activeMedia.resolution || "HD"} • {activeMedia.duration}с • {activeMedia.cost} кр.
              </span>
              <button onClick={() => setActiveMedia(null)} style={{ background: "transparent", border: "none", color: "#fff", fontSize: "16px", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ background: "#000", textAlign: "center" }}>
              <video key={activeMedia.url} src={activeMedia.url} controls autoPlay loop playsInline style={{ width: "100%", maxHeight: "70vh", display: "block" }} />
            </div>
            <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <a href={activeMedia.url} target="_blank" rel="noreferrer" download style={{ background: "#4f46e5", color: "#fff", textDecoration: "none", padding: "8px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: "bold" }}>
                ⬇ Скачать файл
              </a>
              <button onClick={() => setActiveMedia(null)} style={{ background: "#222", color: "#ccc", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
