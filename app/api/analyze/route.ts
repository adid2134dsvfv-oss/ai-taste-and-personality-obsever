
import { NextResponse } from "next/server";

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
  const base64 = btoa(binary);
  // 强制指定为图片类型，避免 application/octet-stream
  const ext = file.name.split('.').pop()?.toLowerCase();
  const mimeType = ext === 'png' ? 'image/png' : 
                   ext === 'gif' ? 'image/gif' : 'image/jpeg';
  return `data:${mimeType};base64,${base64}`;
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
    
    const allFiles = formData.getAll("moments")
      .concat(formData.getAll("playlist"))
      .concat(formData.getAll("snaps"))
      .filter((item) => item instanceof File) as File[];

    const imageContents = await Promise.all(
      allFiles.slice(0, 4).map(async (file) => ({
        type: "image_url" as const,
        image_url: { url: await fileToDataUrl(file) }
      }))
    );

    // ✅ 修复：更严格、更具体的 Prompt
    const systemPrompt = `你是一位毒辣的观察家，擅长从图片细节中挖掘人的独特性。

【绝对禁令 - 出现以下情况视为失败】
1. 禁止使用：沉默、寡言、内向、外向、不善表达、需要多沟通、打开自己
2. 禁止使用 celebrity 类比（如梁朝伟、张国荣、王菲等）
3. 禁止给出"心理健康建议"或"性格改进建议"
4. 禁止用"虽然...但是..."的转折句式

【强制流程 - 必须按顺序执行】
1. 【观察】列出图片中3个你实际看到的具体细节（颜色、物品、文字、构图）
2. 【矛盾】找出这3个细节之间的冲突或不协调之处
3. 【推断】基于这个矛盾，推断一个反直觉的性格特征
4. 【对标】找一个非明星的具体人物（如：楼下便利店的老板、你小学数学老师）
5. 【天赋】指出一个与"沟通/表达"完全无关的隐藏能力

【风格要求】
- 用比喻代替形容词（不说"敏感"，说"像一台调频过宽的收音机"）
- 语气像老朋友吐槽，带点幽默感
- 每个分析必须独一无二，不能套用任何模板

【输出格式 - 纯净JSON】
{
  "analysis": "基于观察的分析（350字，必须包含观察到的细节）",
  "celebrity": "非明星对标人物及原因（100字）",
  "talent": "与表达无关的天赋（70字）",
  "advice": "一个具体的、可执行的生活建议（50字，禁止是'多表达'）"
}`;

    // ✅ 修复：不再默认填充"沉默"
    const userText = reflection 
      ? `用户自述：${reflection}`
      : `用户没有提供文字描述，请完全基于图片进行分析。`;

    const response = await fetch("https://api.moonshot.cn/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MOONSHOT_API_KEY}`
      },
      body: JSON.stringify({
        model: "moonshot-v1-128k-vision-preview",
        temperature: 0.9,  // 再高一点
        top_p: 0.95,
        frequency_penalty: 0.6,  // 增加：惩罚重复用词
        presence_penalty: 0.4,   // 增加：鼓励新话题
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
    
    // 调试：打印原始输出，看是否真的多样化
    console.log("AI原始输出:", content.slice(0, 500));
    
    const parsed = extractJson(content);
    return NextResponse.json(parsed);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
