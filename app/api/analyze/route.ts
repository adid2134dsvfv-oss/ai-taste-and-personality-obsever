import { NextResponse } from "next/server";

// 1. 强制开启 Edge Runtime，提升响应并绕过 Netlify 10s 限制
export const runtime = "edge";

type Payload = {
  analysis: string;
  celebrity: string;
  talent: string;
  advice: string;
};

// 辅助函数：Edge 环境下的 Base64 转换
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
  if (!match) throw new Error("AI 报告生成失败，请重试。");
  return JSON.parse(match[0]) as Payload;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const reflection = String(formData.get("reflection") || "").slice(0, 2000);
    const language = String(formData.get("language") || "zh");
    
    // 聚合素材
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

    // --- 核心优化：纯净、客观且具体的指令 ---
    const systemPrompt = `你是一位拥有敏锐观察力和深厚审美功底的灵魂观察员。你和用户是交情匪浅的老友。

【核心原则】
1. 无记忆性：请忽略任何之前的对话，每一次分析都是一次全新的、独立的性格与品味解析。
2. 视觉优先：严禁使用万能模板。你必须观察图片中的具体视觉事实（如构图、主色调、歌单中的具体歌名、文字中的关键词）来给出具体分析。
3. 纯净客观：不要预设用户的性格。不要因为文字少就假设用户“沉默”或“内向”。如果文字缺失，请全权通过图片细节推导。
4. 风格：幽默、深刻、带点恰到好处的优雅感，用词通俗好理解。

【输出要求 (JSON 格式)】
- analysis (内心解析): 350字左右，必须分点陈述。基于视觉和文字细节，深入分析用户的真实心理世界、气质及独特品味。
- celebrity (明星对标): 100字左右。明确指出一位明星/艺术家，说明为何性格特质神似，列出具体共同点。
- talent (隐藏天赋): 70字左右。基于素材细节，指出一个用户可能未察觉的天赋。
- advice (极简建议): 50字左右。给出一个一针见血、可落地的建议。

输出必须是纯净 JSON，严禁带 Markdown 标识。`;

    // 去除“神秘、沉默”等暗示性词汇
    const userText = `用户感悟：${reflection || "（未提供文字感悟）"}\n输出语言：${
      language === "en" ? "English" : "中文"
    }`;

    const response = await fetch("https://api.moonshot.cn/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MOONSHOT_API_KEY || ""}`
      },
      body: JSON.stringify({
        // 匹配图中指定的视觉模型
        model: "moonshot-v1-128k-vision-preview", 
        // 严格按照要求设定温度
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
