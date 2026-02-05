import { NextResponse } from "next/server";

// 使用 Edge Runtime 确保在全球范围内（包括香港节点）拥有最佳响应速度
export const runtime = "edge";

// 定义输出结构，仅保留核心的两项深度分析
type Payload = {
  analysis: string;
  celebrity: string;
};

// 辅助函数：将图片文件转换为符合智谱 API 规范的 Base64 Data URL
async function fileToDataUrl(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:${file.type};base64,${btoa(binary)}`;
}

// 辅助函数：从 AI 的混合文本中精准提取 JSON 数据块
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
    
    // 聚合用户上传的所有碎片图片
    const allFiles = formData.getAll("moments")
      .concat(formData.getAll("playlist"))
      .concat(formData.getAll("snaps"))
      .filter((item) => item instanceof File) as File[];

    // 智谱视觉模型支持多图输入，我们将前 4 张图片转为 Base64 数组
    const imageContents = await Promise.all(
      allFiles.slice(0, 4).map(async (file) => ({
        type: "image_url",
        image_url: { url: await fileToDataUrl(file) }
      }))
    );

    // 提示词：强调接地气、由点及面的文学感，并严禁套路话
    const userPrompt = `【任务：灵魂碎片素描】
你好，请作为我的“生活观察员”，帮我解读一下这些生活碎片。

要求：
1. **微观切入**：请从我提供的图片中，盯住一个“极其细小”的局部（比如歌单里某句触动你的歌词、照片角落里的一束光影、或者某个随手摆放的物件）。
2. **由点及面**：通过这个微小的切入点，慢慢把视角拉远，聊聊你对我整体气质、生活品味和灵魂状态的观察。要看局部，更要看局部折射出的整体。
3. **拒绝套路**：绝对不准说“内心细腻”、“热爱生活”、“善于表达”等没营养的 AI 废话。要定制化，要像个懂我的老朋友。
4. **语言风格**：通俗易懂、接地气，带点散文般的文学感，但不要堆砌辞藻。

请严格仅以纯 JSON 格式输出：
{
  "analysis": "550字左右：从小细节延伸到整体人格画像的深度聊天。要深刻、动人、好读。",
  "celebrity": "150字左右：哪位知名人物的“磁场”跟我神似？聊聊那种整体氛围的共鸣。"
}

我的文字感悟：${reflection}
输出语言：${language === "zh" ? "中文" : "English"}`;

    const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions",) {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // 从 Zeabur 环境变量中读取 API Key
        "Authorization": `Bearer ${process.env.ZHIPU_API_KEY}`
      },
      body: JSON.stringify({
        model: "glm-4.6v-flash", // 切换至用户指定的最新 4.6V 视觉模型
        messages: [
          { 
            role: "user", 
            content: [
              { type: "text", text: userPrompt },
              ...imageContents
            ] 
          }
        ],
        // 关键参数：开启采样并设置温度，确保输出不重复且有灵气
        do_sample: true,
        temperature: 0.88, 
        top_p: 0.9,
        max_tokens: 2500
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: "智谱接口响应异常", details: errorText }, { status: response.status });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // 解析结果并返回给前端
    const parsed = extractJson(content);
    return NextResponse.json(parsed);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
