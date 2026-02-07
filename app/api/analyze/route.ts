import { NextResponse } from "next/server";

// Node.js Runtime，保证 process.env 在 Zeabur 等环境下可用
export const runtime = "nodejs";

const MAX_IMAGES = 8;

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
    const reflection = String(formData.get("reflection") || "").trim().slice(0, 2000);
    const language = String(formData.get("language") || "zh");

    const allFiles = formData
      .getAll("moments")
      .concat(formData.getAll("playlist"))
      .concat(formData.getAll("snaps"))
      .filter((item) => item instanceof File) as File[];

    if (allFiles.length === 0 && !reflection) {
      return NextResponse.json(
        { error: "请至少上传一张图片或填写文字感悟，以便进行个性化分析。" },
        { status: 400 }
      );
    }

    // 最多 8 张图片，与前端约定一致；智谱多模态支持多图 + 文本同时分析
    const imageContents = await Promise.all(
      allFiles.slice(0, MAX_IMAGES).map(async (file) => ({
        type: "image_url",
        image_url: { url: await fileToDataUrl(file) },
      }))
    );

    const langLabel = language === "zh" ? "中文" : "English";
    const systemPrompt = `你是一位内心世界观察员。请同时分析用户提供的「图片」与「文字」：
- **主要依据**：用户上传的图片（最多 ${MAX_IMAGES} 张）。请仔细观察每一张图片中的场景、人物、物品、氛围、色彩、构图等，从视觉信息推断用户的品味、性格与真实需求。
- **次要依据**：用户写下的文字感悟。若用户提供了感悟，必须与图片内容结合，做连贯的、个性化的解读，不要忽略任何一段文字。

分析时请结合你所识别到的图片信息（如人物姿态、神态、穿着风格、场景氛围、色彩关系、构图重心等），并从整体视觉与审美感受，图中的细节与文字出发进行推断。若图片或文字存在模糊、不完整之处，请基于常见审美与分析性格的方法与还有心理语境做合理推断，不得要求用户补充信息，不得中断任务或输出免责声明。

请严格按照以下结构与字数要求输出完整内容：
- 600字：对用户性格、品味与表达诉求进行深度的，具体的详细的分点分析，要求多表达不同方面的见解，最后用两三句话夸一夸用户。  
- 150字：寻找气质或精神层面的知名国内外明星对标，并说明相似原因与共同特征（非外貌对比）  
 

最终结果请仅以**纯 JSON 格式**输出，不得包含任何额外文本。
输出语言：${langLabel}。`;

    const userText = [
      reflection ? `【用户文字感悟】（请与上方图片结合分析）\n${reflection}` : "",
      `【输出语言】${langLabel}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const apiKey = process.env.ZHIPU_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "未配置智谱 API Key。请在 .env 或 Zeabur 环境变量中设置 ZHIPU_API_KEY。",
        },
        { status: 500 }
      );
    }

    // 智谱开放平台 v4 对话补全，视觉模型 glm-4.5v 支持多图 + 文本
    const response = await fetch(
      "https://open.bigmodel.cn/api/paas/v4/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "GLM-4.6V-FlashX",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text:
                    userText ||
                    "请根据以上图片进行分析，输出语言：" + langLabel,
                },
                ...imageContents,
              ],
            },
          ],
          temperature: 0.85,
          top_p: 0.9,
          max_tokens: 2048,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: "智谱 API 报错", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";

    if (!content) {
      return NextResponse.json(
        { error: "智谱 API 未返回有效内容", details: JSON.stringify(data) },
        { status: 502 }
      );
    }

    const parsed = extractJson(content);
    return NextResponse.json(parsed);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "服务器内部错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
