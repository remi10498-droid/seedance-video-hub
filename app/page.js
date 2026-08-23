const MODEL_SPECS = {
  "seedance-2.5": {
    name: "Seedance 2.5 (Флагман)",
    durations: ["4", "5", "6", "7", "8", "10", "15", "20"], // Лимит OpenAPI — 20 сек[cite: 6]
    resolutions: [
      { id: "480p", label: "480p" },
      { id: "720p", label: "720p (HD)" },
      { id: "1080p", label: "1080p (FHD)" },
    ],
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
    hasAudio: true,
  },
  "seedance-2.0": {
    name: "Seedance 2.0 (Fast)",
    durations: ["4", "5", "6", "7", "8", "10", "12", "15"], 
    resolutions: [
      { id: "720p", label: "720p (HD)" },
    ],
    ratios: ["16:9", "9:16", "1:1"],
    hasAudio: true,
  },
  "flux-3-video": {
    name: "Flux 3 Video",
    durations: ["5", "10", "15", "20"],
    resolutions: [
      { id: "720p", label: "HD (720p)" },
      { id: "1080p", label: "FHD (1080p)" },
    ],
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    hasAudio: true,
  },
  "kling-v3-pro": {
    name: "Kling 3.0",
    durations: ["5", "10"],
    resolutions: [
      { id: "720p", label: "720p (HD)" },
    ],
    ratios: ["16:9", "9:16", "1:1"],
    hasAudio: true,
  },
  "wan-3.0-video": {
    name: "Wan 3.0 Video",
    durations: ["5", "10", "15", "20"], // Максимум по OpenAPI
    resolutions: [
      { id: "720p", label: "720P (HD)" },
    ],
    ratios: ["16:9", "9:16", "1:1"],
    hasAudio: true,
  },
  "grok-imagine-video-1.5": {
    name: "Grok Video 1.5",
    durations: ["3", "5", "6", "8", "10", "12", "15"], // Точный шаг по документации
    resolutions: [
      { id: "720p", label: "720p (HD)" },
    ],
    ratios: ["16:9", "9:16", "1:1"],
    hasAudio: true,
    requiresImage: true,
  },
  "sora-2-pro": {
    name: "OpenAI Sora 2 Pro",
    durations: ["4", "8", "12", "16", "20"],
    resolutions: [
      { id: "720p", label: "720p (HD)" },
    ],
    ratios: ["16:9", "9:16"],
    hasAudio: false,
  },
};
