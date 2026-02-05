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

    const systemPrompt = `你是一位拥有审美能力的内心世界观察员。

请基于用户上传的图片进行人物的内心世界、品味与气质分析。
分析时请优先结合你能识别到的图片细节（如穿着风格、神态气质、场景氛围、色彩关系、构图与视觉重心等）。

若图片细节不完整、模糊或存在不确定性，请基于整体视觉感受与常见审美语境进行合理推断，不得要求用户补充信息，不得中断任务。

请严格按照以下要求输出：
- 350字：分点的内心世界 / 品味 / 气质分析
- 100字：明星气质或风格对标（非外貌对比）
- 70字：个人天赋倾向
- 50字：成长或风格建议

必须输出完整内容，不得提及“图片不足”“无法判断”等说明。
最终结果请**仅以纯 JSON 格式输出**，不包含任何多余文本。
语言：中文。`;

    const response = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // 修改点：从环境变量中读取 API Key
        "Authorization": `Bearer ${process.env.DOUBAO_API_KEY}`
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
