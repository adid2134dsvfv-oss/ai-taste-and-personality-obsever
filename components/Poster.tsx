"use client";

import { forwardRef } from "react";

interface PosterProps {
  // name: string;
  // analysis: string;
  // celebrity: string;
  // talent: string;
  // advice: string;
  // language: "zh" | "en";
  data: Object,
}

const Poster = forwardRef<HTMLDivElement, PosterProps>(
  // ({ name, analysis, celebrity, talent, advice, language }, ref) => {
  ({ data }, ref) => {
    if (!data || Object.keys(data).length === 0) {
      return null
    }
    console.log('data', data);
    console.log('ref', ref);
    const language = "zh";
    const labels =
      language === "zh"
        ? {
            title: "AI 品味与性格观察员",
            subtitle: "灵魂报告",
            analysis: "内心解析",
            celebrity: "明星对标",
            talent: "隐藏天赋",
            advice: "极简建议"
          }
        : {
            title: "AI Taste & Personality Observer",
            subtitle: "Soul Report",
            analysis: "Inner Reading",
            celebrity: "Celebrity Match",
            talent: "Hidden Talent",
            advice: "Minimal Advice"
          };

    return (
      <div
        ref={ref}
        className="w-full max-w-2xl rounded-[32px] border border-white/20 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-10 text-white shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
      >
        <header className="space-y-4 border-b border-white/20 pb-6">
          <p className="text-sm uppercase tracking-[0.4em] text-white/60">
            {labels.subtitle}
          </p>
          <h2 className="font-display text-3xl tracking-tight">
            {labels.title}
          </h2>
          {/* <p className="text-sm text-white/60">{name}</p> */}
        </header>
        <section className="mt-6 space-y-5">
          {/* <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">
              {labels.analysis}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/90">
              {analysis}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">
              {labels.celebrity}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/90">
              {celebrity}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">
              {labels.talent}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/90">
              {talent}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">
              {labels.advice}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/90">
              {advice}
            </p>
          </div> */}
{Object.entries(data ?? {}).map(([key, value]) => (
      <div key={key}>
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">
          {key}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-white/90">
          {value}
        </p>
      </div>
    ))}
        </section>
        <footer className="mt-8 border-t border-white/20 pt-6 text-xs text-white/50">
          {language === "zh"
            ? "本报告由 AI 娱乐生成，不代表专业建议。"
            : "This report is generated for entertainment and is not professional advice."}
        </footer>
      </div>
    );
  }
);

Poster.displayName = "Poster";

export default Poster;
