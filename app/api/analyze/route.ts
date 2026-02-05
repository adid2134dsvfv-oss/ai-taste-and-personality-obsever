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

    // const systemPrompt = `请根据图片分析用户的内心世界，性格，气质，想表达的意思与需求。不得要求用户补充信息，不得中断任务。350字深度分析。100字找出明星对标，并说明为什么相似。以及共同的特点。70字天赋挖掘。50字可以改变的一条极简建议。纯JSON输出`;
const systemPrompt = `请基于用户上传的图片，对用户的【内心世界、性格特征、气质状态、想表达的潜在意思与真实需求】进行分析。
分析时请优先结合你所识别到的图片信息（如人物姿态、神态、穿着风格、场景氛围、色彩关系、构图重心等），从整体视觉与审美感受出发进行推断。

若图片信息存在模糊、不完整或不确定之处，请基于常见审美语境与合理心理推演进行分析，不得要求用户补充任何信息，不得中断或缩减任务，不得输出免责声明或不确定性说明。

请严格按照以下结构与字数要求输出完整内容：
- 350字：对用户内心世界、性格、气质与表达诉求的深度分点分析  
- 100字：寻找气质或精神层面的明星对标，并说明相似原因与共同特征（非外貌对比）  
- 70字：个人天赋或潜在优势挖掘  
- 50字：一条可执行的极简改变建议  

无论图片清晰度或信息完整度如何，必须完成全部分析内容。
最终结果请仅以**纯 JSON 格式**输出，不得包含任何额外文本。
语言：中文。`;
//     const systemPrompt = `你是一位内心世界观察员。

// 请基于用户上传的图片进行人物的内心世界、品味与气质分析。
// 分析时请优先结合你能识别到的图片细节（如穿着风格、神态气质、场景氛围、色彩关系、构图与视觉重心等）。

// 若图片细节不完整、模糊或存在不确定性，请基于整体视觉感受与常见审美语境进行合理推断，不得要求用户补充信息，不得中断任务。

// 请严格按照以下要求输出：
// - 350字：分点的内心世界 / 品味 / 气质分析
// - 100字：明星气质或风格对标（非外貌对比）
// - 70字：个人天赋倾向
// - 50字：成长或风格建议

// 必须输出完整内容，不得提及“图片不足”“无法判断”等说明。
// 最终结果请**仅以纯 JSON 格式输出**，不包含任何多余文本。
// 语言：中文。`;
// const systemPrompt = `你是一位拥有审美的内心世界观察员。请结合图片细节进行具体的内心世界，品味，气质分析。350字分点分析，100字明星对标，70字天赋，50字建议。纯JSON输出。`;

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
