import { NextResponse } from "next/server";

// 依然保留 Edge Runtime 提升网络性能
export const runtime = "edge";

type Payload = {
  analysis: string;
  celebrity: string;
  talent: string;
  advice: string;
};

async function fileToDataUrl(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:${file.type};base64,${btoa(binary)}`;
}

function extractJson(text: string): Payload {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI 报告生成格式错误");
  return JSON.parse(match[0]) as Payload;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const reflection = String(formData.get("reflection") || "").slice(0, 2000);
    const language = String(formData.get("language") || "zh");
    
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

    const systemPrompt = `你是一位拥有审美的内心世界观察员。请结合图片细节进行具体的内心世界，品味，气质分析。350字分点分析，100字明星对标，70字天赋，50字建议。纯JSON输出。`;

    const response = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer 8e8613b7-0643-4d9c-a892-10c16b290c2e"
      },
      body: JSON.stringify({
        model: "doubao-seed-1-6-vision-250815",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: [
              { type: "text", text: `感悟：${reflection}\n语言：${language}` },
              ...imageContents
            ] 
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: "API 报错", details: errorText }, { status: response.status });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const parsed = extractJson(content);

    return NextResponse.json(parsed);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
