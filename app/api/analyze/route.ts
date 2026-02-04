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

    // 核心改进：深度幽默、带点“装逼”感的专家级提示词
    const systemPrompt = `你是一位懂生活、审美超群、洞察人性的老友。你擅长从细微的像素中剖析一个人真正的心理世界与需求和品味气质。

风格指南：
1. 语气：深度幽默，带一点恰到好处的“装逼”感（那种看透世俗后的松弛感），通俗易懂但字字珠玑。
2. 视角：像深夜酒局后的老友交心，直击用户真实的内心世界。
3. 规则：严禁使用“心理测试、诊断”等生硬词汇；输出必须是纯 JSON 格式，不含任何多余文本。

输出字段要求：
- analysis (内心解析): 200字左右。深度剖析用户的真实心理世界与需求、气质与潜意识里的审美取向。
- celebrity (明星对标): 100字左右。明确指出一位明星或艺术家，说明共同的“闪光点”及相似的灵魂特质。
- talent (隐藏天赋): 70字左右。指出一个用户自己可能都没察觉到的惊人天赋。
- advice (极简建议): 50字左右。只说一点，一针见血且极具落地感的个性化建议。

输出 JSON 格式：
{"analysis":"...","celebrity":"...","talent":"...","advice":"..."}`;

    const response = await fetch("https://api.moonshot.cn/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MOONSHOT_API_KEY}`
      },
      body: JSON.stringify({
        // 核心修改：匹配图中模型与温度
        model: "moonshot-v1-128k-vision-preview", 
        temperature: 0.3, 
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: [
              { type: "text", text: `这是用户最近的感悟：${reflection || "（这人话不多）"}。请结合这些碎片和感悟，用${language === "en" ? "英语" : "中文"}进行灵魂侧写。` },
              ...imageContents
            ] 
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: "AI 接口异常", message: errorText }, { status: response.status });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const parsed = extractJson(content);

    return NextResponse.json(parsed);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
