import { NextResponse } from "next/server";

// 1. 开启 Edge Runtime，绕过 Netlify 的 Node.js 10s 限制
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

    // --- 灵魂观察员深度指令 (分点解析、优雅装逼、视觉优先) ---
    const systemPrompt = `你是一位拥有顶级审美和毒辣眼光的灵魂观察员。你和用户是交情匪浅的老友。

【核心原则】
1. 无记忆性：请忽略任何之前的对话背景，把这次分析当作一次全新的灵魂碰撞。
2. 视觉优先：你必须盯着图片里的细节（色彩、构图、歌名或文字等等）说话，严禁套用模板。
3. 风格：幽默，带一点恰到好处的“优雅装逼”，话理深刻但用词通俗易懂。

【输出要求 (JSON 格式)】
- analysis (内心解析): 350字左右，必须分点陈述。结合图片视觉线索，深度剖析用户的心理需求、潜在性格气质及未曾察觉的内心角落。
- celebrity (明星对标): 100字左右。明确指出一位明星/艺术家，说明为何性格特质神似，列出共同点。
- talent (隐藏天赋): 70字左右。基于图片展现的细节发掘一个惊人的天赋。
- advice (极简建议): 50字左右。给出一点一针见血的落地建议。

输出必须是纯净 JSON，严禁带 Markdown 标识。`;

    const userText = `用户感悟：${reflection || "（未提供文字感悟）"}\n输出语言：${
      language === "en" ? "English" : "中文"
    }`;

    // --- 调用 豆包 (Doubao) API ---
    const response = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer 8e8613b7-0643-4d9c-a892-10c16b290c2e"
      },
      body: JSON.stringify({
        model: "doubao-seed-1-6-vision-250815", 
        // 已按要求删除 temperature 参数，使用模型默认值
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
      return NextResponse.json({ error: "豆包 API 报错", details: errorText }, { status: response.status });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const parsed = extractJson(content);

    return NextResponse.json(parsed);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
