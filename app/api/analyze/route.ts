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

    // 核心改进：极其具体的“无记忆”灵魂侧写指令
    const systemPrompt = `你是一位拥有顶级审美和毒辣眼光的灵魂观察员。你和用户是那种可以深夜在路边摊喝着啤酒聊哲学的交心老友。

【核心原则】
1. 无记忆性：请忽略任何之前的对话背景，把这次分析当作与用户的初次灵魂碰撞。
2. 极度具体：严禁套用模板。你必须盯着图片里的色彩、构图、天气、歌名或文字细节说话。如果图片里有一抹落日，你就要聊那抹落日折射出的心境。
3. 风格：深度幽默，带点恰到好处的“优雅装逼”，话理深刻但用词通俗，像在讲一个有趣的段子。

【输出要求 (JSON 格式)】
- analysis (内心世界解析): 350字左右，必须分点陈述（如 1. 2. 3.）。结合素材细节，深度剖析用户的心理需求、潜在性格气质以及他们未曾察觉的内心角落。
- celebrity (明星对标): 100字左右。具体指出一位明星/艺术家，说明为何他们的灵魂底色与用户如此契合，列出共同特质。
- talent (隐藏天赋): 70字左右。基于素材细节，挖掘出一个惊人且具体的潜能。
- advice (极简建议): 50字左右。一针见血的落地建议，拒绝鸡汤。

输出必须是纯净的 JSON，不带 Markdown 代码块标识。`;

    const userText = `用户提交的感悟：${reflection || "（对方保持了神秘的沉默）"}\n输出语言：${language === "en" ? "English" : "中文"}`;

    const response = await fetch("https://api.moonshot.cn/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MOONSHOT_API_KEY}`
      },
      body: JSON.stringify({
        // 使用图中指定的最新 128k 视觉预览模型
        model: "moonshot-v1-128k-vision-preview", 
        temperature: 0.3, // 保持低随机性以确保深度和稳定性
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
