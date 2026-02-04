import { NextResponse } from "next/server";

// 1. 关键：强制开启边缘运行时，绕过标准函数的限制
export const runtime = "edge";

type Payload = {
  analysis: string;
  celebrity: string;
  talent: string;
  advice: string;
};

const MAX_COUNTS = {
  moments: 4,
  playlist: 2,
  snaps: 2
};

function clampFiles(files: File[], max: number) {
  return files.slice(0, max);
}

// 优化：Edge 环境下处理图片的方式
async function fileToDataUrl(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
  );
  return `data:${file.type};base64,${base64}`;
}

function extractJson(text: string): Payload {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in AI response");
  return JSON.parse(match[0]) as Payload;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const reflection = String(formData.get("reflection") || "").slice(0, 2000);
    const language = String(formData.get("language") || "zh");
    
    // 过滤与截取文件
    const moments = clampFiles(formData.getAll("moments").filter((item) => item instanceof File) as File[], MAX_COUNTS.moments);
    const playlist = clampFiles(formData.getAll("playlist").filter((item) => item instanceof File) as File[], MAX_COUNTS.playlist);
    const snaps = clampFiles(formData.getAll("snaps").filter((item) => item instanceof File) as File[], MAX_COUNTS.snaps);

    const allImages = [...moments, ...playlist, ...snaps];
    
    // 提示：如果图片过多，建议在前端压缩后再上传
    const imageContents = await Promise.all(
      allImages.map(async (file) => ({
        type: "image_url",
        image_url: { url: await fileToDataUrl(file) }
      }))
    );

    const systemPrompt = `你是一位懂生活、高情商、审美超群的老友。输出必须是纯 JSON。分析、明星、特质、建议各字段按要求填写。`;

    const userText = `用户感悟：${reflection || "（无）"}\n输出语言：${language === "en" ? "英语" : "中文"}`;

    // 发起 API 请求
    const response = await fetch("https://api.moonshot.cn/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MOONSHOT_API_KEY}`
      },
      body: JSON.stringify({
        model: "moonshot-v1-vision", // 确保模型名称准确
        temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: [{ type: "text", text: userText }, ...imageContents] }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Moonshot API Error:", errorData);
      return NextResponse.json({ error: "AI 服务暂时不可用" }, { status: response.status });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const parsed = extractJson(content);

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("Detailed Error:", error.message);
    return NextResponse.json({ error: error.message || "分析过程中发生未知错误" }, { status: 500 });
  }
}
