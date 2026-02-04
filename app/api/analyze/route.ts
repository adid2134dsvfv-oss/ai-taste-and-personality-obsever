import { NextResponse } from "next/server";

// 1. 开启 Edge Runtime，提升响应速度并规避标准函数限制
export const runtime = "edge";

type Payload = {
  analysis: string;
  celebrity: string;
  talent: string;
  advice: string;
};

// 辅助函数：将图片转为标准 Base64 格式
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
  if (!match) throw new Error("AI 脑回路卡住了，没能生成有效的 JSON 报告。");
  return JSON.parse(match[0]) as Payload;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const reflection = String(formData.get("reflection") || "").slice(0, 2000);
    const language = String(formData.get("language") || "zh");
    
    // 聚合所有上传的图片素材
    const allFiles = formData.getAll("moments")
      .concat(formData.getAll("playlist"))
      .concat(formData.getAll("snaps"))
      .filter((item) => item instanceof File) as File[];

    // 转换为 AI 可读的多模态格式
    const imageContents = await Promise.all(
      allFiles.slice(0, 4).map(async (file) => ({
        type: "image_url",
        image_url: { url: await fileToDataUrl(file) }
      }))
    );

    // 具体的分析指令
    const systemPrompt = `你是一个拥有审美和分析他人性格，品味，气质的技巧的ai。你和用户是老朋友。

【核心原则】
1. 无记忆性：请忽略任何之前的对话背景，把这次分析当作一次全新的性格，品味，气质分析。
2. 比较具体：严禁套用模板。
3. 风格：幽默，有见解，用词好理解。

【输出要求 (JSON 格式)】
- analysis (内心解析): 350字左右，必须分点陈述（如 1. 2. 3.）。分析用户的真实心理世界、气质以及他们独特品味。
- celebrity (明星对标): 100字左右。明确指出一位明星/艺术家，说明为何性格特质差不多，列出共同点。
- talent (隐藏天赋): 70字左右。指出一个用户自己可能没察觉到的天赋。
- advice (极简建议): 50字左右。只说一点，可落地的建议。

输出必须是纯净的 JSON，不带任何 Markdown 标识。`;

    const userText = `用户感悟：${reflection || "（对方保持了神秘的沉默）"}\n输出语言：${
      language === "en" ? "English" : "中文"
    }`;

    const response = await fetch("https://api.moonshot.cn/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MOONSHOT_API_KEY}`
      },
      body: JSON.stringify({
        // 核心修改：使用图中指定的模型与温度设置
        model: "moonshot-v1-128k-vision-preview", 
        temperature: 0.81, 
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: [
              { type: "text", text: userText },
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
