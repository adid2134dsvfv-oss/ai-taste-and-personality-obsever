import "../styles/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI 品味与性格观察员",
  description: "AI taste and personality observer"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
