"use client";

import { useEffect, useRef } from "react";

export default function AdBanner() {
  const adRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).adsbygoogle) {
      try {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push(
          {}
        );
      } catch (e) {
        console.error("AdSense error:", e);
      }
    }
  }, []);

  return (
    <ins
      ref={adRef}
      className="adsbygoogle"
      style={{ display: "block" }}
      data-ad-client="ca-pub-2751934218489264"
      data-ad-slot="你的广告单元ID"
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}
