import { NextResponse } from "next/server";

// 依然保留 Edge Runtime 提升网络性能
export const runtime = "edge";

// 更新后的数据结构，仅保留核心两项
type Payload = {
  analysis: string;
  celebrity: string;
};

// 辅助函数：将图片转为 Base64
async function fileToDataUrl(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:${file.type};base64,${btoa(binary)}`;
}

// 辅助函数：从返回内容中提取 JSON
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
    
    // 收集图片
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

    // 优化的“由点及面”文学感提示词
    const userPrompt = `【任务：灵魂碎片素描】
请你当一回我的“生活观察员”。请仔细盯着我分享的这些碎片看，结合我的感悟，给我写一段话。

要求：
1. **微观切入**：请先从照片里一个“极其微小”的细节出发（比如歌单里某句歌词、照片某个角落的光影、或者物品的一个摆放习惯）。
2. **宏观观察**：通过这个小细节，慢慢把视角拉远，聊聊你对我整体气质、性格和生活状态的观察。要看局部，也要看整体。
3. **语言风格**：像老朋友聊天一样接地气、通俗。要有散文般的文学感和画面感，但别整那些深奥的词。
4. **拒绝套路**：绝对不准说“内心细腻”、“热爱生活”、“善于沟通”这种 AI 万金油废话。

请仅以纯 JSON 格式输出，不要说任何额外文字：
{
  "analysis": "550字左右：从极致微观细节切入，延伸到整体气质的深度聊天。要深刻、动人、好读。",
  "celebrity": "150字左右：哪位知名明星散发的磁场与我神似？描述那种整体氛围的共鸣感。"
}

我的感悟：${reflection}
输出语言：${language === "zh" ? "中文" : "English"}`;

    const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // 请确保在 Zeabur 环境变量中配置了 ZHIPU_API_KEY
        "Authorization": `Bearer ${process.env.ZHIPU_API_KEY || "6d6ab0a962484588b2064a76d0d8756d.nf5Mx4uWVUqGh5DJ"}`
      },
      body: JSON.stringify({
        model: "glm-4v-flash", 
        messages: [
          { 
            role: "user", 
            content: [
              { type: "text", text: userPrompt },
              ...imageContents
            ] 
          }
        ],
        temperature: 0.88, // 保持灵气与不重复
        top_p: 0.9,
        max_tokens: 2500,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: "接口连接失败", details: errorText }, { status: response.status });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // 解析并返回给前端
    const parsed = extractJson(content);
    return NextResponse.json(parsed);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
