"use client";

import { useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import {
  CloudUpload,
  Globe,
  ImageIcon,
  LoaderCircle,
  Music2,
  Sparkles,
  Trash2
} from "lucide-react";
import Poster from "../components/Poster";

// --- 深度优化压缩辅助函数：平衡识别精度与传输速度 ---
async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        
        // 核心优化：提升至 1280px 以确保 AI 能看清截图中的文字细节
        const MAX_SIZE = 1280; 

        if (width > height && width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        } else if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          // 开启高质量图像绘制
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, width, height);
        }

        canvas.toBlob(
          (blob) => {
            const newFileName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
            resolve(new File([blob!], newFileName, { type: "image/jpeg" }));
          },
          "image/jpeg",
          0.8 // 提升至 0.8，减少文字周围的伪影，极大辅助 AI OCR 识别
        );
      };
    };
  });
}

const LOADING_LINES = [
  "正在通过图片发现你的性格，气质与内心世界...",
  "正在你的歌单里寻找共鸣...",
  "正在翻阅你的生活光线...",
  "正在拼接你的审美轮廓..."
];

const MAX_COUNTS = {
  moments: 4,
  playlist: 2,
  snaps: 2
};

type Language = "zh" | "en";

const copy = {
  zh: {
    title: "AI 品味与性格观察员",
    subtitle: "上传你的碎片，生成灵魂报告",
    upload: "上传",
    moments: "朋友圈截图",
    playlist: "歌单截图",
    snaps: "生活随拍",
    reflection: "个人感悟",
    reflectionPlaceholder: "写下一段你最近的感悟或状态...",
    analyze: "开始分析",
    analyzing: "灵魂解析中...",
    report: "结果与海报",
    analysis: "内心解析",
    celebrity: "明星对标",
    talent: "隐藏天赋",
    advice: "极简建议",
    savePoster: "保存品味海报",
    disclaimer: "本报告由 AI 娱乐生成，不代表专业建议。",
    previewHint: "可拖拽查看更多",
    language: "语言"
  },
  en: {
    title: "AI Taste & Personality Observer",
    subtitle: "Upload your fragments and generate a soul report",
    upload: "Upload",
    moments: "Moments screenshots",
    playlist: "Playlist screenshots",
    snaps: "Lifestyle shots",
    reflection: "Personal reflection",
    reflectionPlaceholder: "Share a recent thought or feeling...",
    analyze: "Analyze",
    analyzing: "Analyzing your soul...",
    report: "Result & Poster",
    analysis: "Inner Reading",
    celebrity: "Celebrity Match",
    talent: "Hidden Talent",
    advice: "Minimal Advice",
    savePoster: "Save Taste Poster",
    disclaimer: "This report is generated for entertainment and is not professional advice.",
    previewHint: "Scroll to preview",
    language: "Language"
  }
};

function FilePreview({
  files,
  onRemove
}: {
  files: File[];
  onRemove: (index: number) => void;
}) {
  return (
    <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
      {files.map((file, index) => (
        <div
          key={`${file.name}-${index}`}
          className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl border border-white/20"
        >
          <img
            src={URL.createObjectURL(file)}
            alt={file.name}
            className="h-full w-full object-cover"
          />
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-white hover:bg-black"
            aria-label="Remove"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [language, setLanguage] = useState<Language>("zh");
  const [moments, setMoments] = useState<File[]>([]);
  const [playlist, setPlaylist] = useState<File[]>([]);
  const [snaps, setSnaps] = useState<File[]>([]);
  const [reflection, setReflection] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState({});
  const [error, setError] = useState<string | null>(null);
  const [lineIndex, setLineIndex] = useState(0);
  const posterRef = useRef<HTMLDivElement>(null);
  const labels = copy[language];

  const loadingLine = useMemo(
    () => LOADING_LINES[lineIndex % LOADING_LINES.length],
    [lineIndex]
  );

  const handleFiles = (
    incoming: FileList | null,
    current: File[],
    max: number,
    setFiles: (files: File[]) => void
  ) => {
    if (!incoming) return;
    const next = [...current, ...Array.from(incoming)].slice(0, max);
    setFiles(next);
  };

  const handleSubmit = async () => {
    setError(null);
    setResult({});
    setLoading(true);

    try {
      const formData = new FormData();
      
      const compressPromises = [
        ...moments.map(file => compressImage(file).then(c => formData.append("moments", c))),
        ...playlist.map(file => compressImage(file).then(c => formData.append("playlist", c))),
        ...snaps.map(file => compressImage(file).then(c => formData.append("snaps", c)))
      ];

      await Promise.all(compressPromises);
      
      formData.append("reflection", reflection);
      formData.append("language", language);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error("Request failed");
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(
        language === "zh"
          ? "分析超时或失败。建议：请减少上传的图片数量，或尝试更稳定的网络。"
          : "Analysis timed out or failed. Hint: Try with fewer images or a more stable connection."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSavePoster = async () => {
    if (!posterRef.current) return;
    const dataUrl = await toPng(posterRef.current, { cacheBust: true });
    const link = document.createElement("a");
    link.download = "taste-poster.png";
    link.href = dataUrl;
    link.click();
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-950 via-slate-950 to-slate-900 px-6 py-16 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-12">
        <header className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.5em] text-white/60">
                Soul Observer
              </p>
              <h1 className="font-display text-4xl sm:text-5xl">
                {labels.title}
              </h1>
            </div>
            <button
              className="flex items-center gap-2 rounded-full border border-white/30 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/70 hover:border-white/60"
              onClick={() =>
                setLanguage((prev) => (prev === "zh" ? "en" : "zh"))
              }
              type="button"
            >
              <Globe className="h-4 w-4" />
              {labels.language}
            </button>
          </div>
          <p className="max-w-2xl text-lg text-white/70">
            {labels.subtitle}
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6 rounded-[32px] border border-white/15 bg-white/5 p-6 backdrop-blur">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm uppercase tracking-[0.3em] text-white/60">
                  {labels.upload}
                </p>
                <span className="text-xs text-white/40">
                  {labels.previewHint}
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="group flex min-h-[160px] cursor-pointer flex-col justify-between rounded-3xl border border-dashed border-white/20 bg-white/5 p-4 transition hover:border-white/50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{labels.moments}</span>
                    <ImageIcon className="h-5 w-5 text-white/50" />
                  </div>
                  <p className="text-xs text-white/50">
                    {MAX_COUNTS.moments} max
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) =>
                      handleFiles(
                        event.target.files,
                        moments,
                        MAX_COUNTS.moments,
                        setMoments
                      )
                    }
                    className="hidden"
                  />
                </label>

                <label className="group flex min-h-[160px] cursor-pointer flex-col justify-between rounded-3xl border border-dashed border-white/20 bg-white/5 p-4 transition hover:border-white/50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{labels.playlist}</span>
                    <Music2 className="h-5 w-5 text-white/50" />
                  </div>
                  <p className="text-xs text-white/50">
                    {MAX_COUNTS.playlist} max
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) =>
                      handleFiles(
                        event.target.files,
                        playlist,
                        MAX_COUNTS.playlist,
                        setPlaylist
                      )
                    }
                    className="hidden"
                  />
                </label>

                <label className="group flex min-h-[160px] cursor-pointer flex-col justify-between rounded-3xl border border-dashed border-white/20 bg-white/5 p-4 transition hover:border-white/50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{labels.snaps}</span>
                    <ImageIcon className="h-5 w-5 text-white/50" />
                  </div>
                  <p className="text-xs text-white/50">
                    {MAX_COUNTS.snaps} max
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) =>
                      handleFiles(
                        event.target.files,
                        snaps,
                        MAX_COUNTS.snaps,
                        setSnaps
                      )
                    }
                    className="hidden"
                  />
                </label>

                <div className="flex min-h-[160px] flex-col gap-3 rounded-3xl border border-white/15 bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{labels.reflection}</span>
                    <Sparkles className="h-5 w-5 text-white/50" />
                  </div>
                  <textarea
                    value={reflection}
                    onChange={(event) => setReflection(event.target.value)}
                    placeholder={labels.reflectionPlaceholder}
                    className="flex-1 resize-none rounded-2xl bg-black/20 p-3 text-sm text-white outline-none placeholder:text-white/30"
                  />
                </div>
              </div>
            </div>

            {moments.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/40">
                  {labels.moments}
                </p>
                <FilePreview
                  files={moments}
                  onRemove={(index) =>
                    setMoments(moments.filter((_, i) => i !== index))
                  }
                />
              </div>
            )}
            {playlist.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/40">
                  {labels.playlist}
                </p>
                <FilePreview
                  files={playlist}
                  onRemove={(index) =>
                    setPlaylist(playlist.filter((_, i) => i !== index))
                  }
                />
              </div>
            )}
            {snaps.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/40">
                  {labels.snaps}
                </p>
                <FilePreview
                  files={snaps}
                  onRemove={(index) =>
                    setSnaps(snaps.filter((_, i) => i !== index))
                  }
                />
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-full bg-white text-slate-950 py-3 text-sm font-semibold uppercase tracking-[0.35em] transition hover:bg-slate-200 disabled:cursor-not-allowed"
            >
              {loading ? (
                <LoaderCircle className="h-5 w-5 animate-spin" />
              ) : (
                <CloudUpload className="h-5 w-5" />
              )}
              {loading ? labels.analyzing : labels.analyze}
            </button>
            {error && (
              <p className="text-sm text-red-300" role="alert">
                {error}
              </p>
            )}
          </div>

          <div className="space-y-6">
            {loading ? (
              <div className="flex h-full flex-col justify-center gap-6 rounded-[32px] border border-white/15 bg-white/5 p-8 text-white/70">
                <LoaderCircle className="h-10 w-10 animate-spin text-white/80" />
                <p className="text-lg">{loadingLine}</p>
                <button
                  type="button"
                  onClick={() => setLineIndex((prev) => prev + 1)}
                  className="text-xs uppercase tracking-[0.3em] text-white/50"
                >
                  next
                </button>
              </div>
            ) : null}

            {result && Object.keys(result).length > 0 && (
              <div className="space-y-4">
                <Poster
                  ref={posterRef}
                  data={result}
                />
                <button
                  type="button"
                  onClick={handleSavePoster}
                  className="w-full rounded-full border border-white/30 bg-white/10 py-3 text-sm uppercase tracking-[0.35em] text-white transition hover:bg-white/20"
                >
                  {labels.savePoster}
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
