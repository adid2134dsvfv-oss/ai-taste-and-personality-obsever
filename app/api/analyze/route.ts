import { NextResponse } from "next/server";

export const runtime = "edge";

type Payload = {
  analysis: string;
  celebrity: string;
  talent: string;
  advice: string;
};

// 辅助函数：Edge 环境下的标准 Base64 转换
async function fileToDataUrl(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return `data:${file.type};base64,${base64}`;
}

function extractJson(text: string): Payload {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI 返回内容格式错误，未找到结果。");
  return JSON.parse(match[0]) as Payload;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const reflection = String(formData.get("reflection") || "").slice(0, 2000);
    const language = String(formData.get("language") || "zh");
    
    // 获取并处理图片
    const allFiles = formData.getAll("moments")
      .concat(formData.getAll("playlist"))
      .concat(formData.getAll("snaps"))
      .filter((item) => item instanceof File) as File[];

    const imageContents = await Promise.all(
      allFiles.slice(0, 4).map(async (file) => ({
        type: "image_url",
        image_url: { url: await fileToDataUrl(file) }
      }))
    );

    const systemPrompt = `你是一位高情商老友，请分析用户的品味。输出必须是纯 JSON 格式：{"analysis":"...","celebrity":"...","talent":"...","advice":"..."}`;

    const response = await fetch("https://api.moonshot.cn/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MOONSHOT_API_KEY}`
      },
      body: JSON.stringify({
        // 核心修改：使用最通用的 vision 支持 ID
        model: "moonshot-v1-8k", 
        temperature: 0.3,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: [
              { type: "text", text: `感悟：${reflection}，语言：${language}` },
              ...imageContents
            ] 
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text(); // 获取 API 返回的具体报错文本
      console.error("Moonshot Error Detail:", errorText);
      return NextResponse.json({ 
        error: "AI 接口报错", 
        message: errorText 
      }, { status: response.status });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const parsed = extractJson(content);

    return NextResponse.json(parsed);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
