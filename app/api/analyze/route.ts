import { NextResponse } from "next/server";

type Payload = {
  analysis: string;
  celebrity: string;
  talent: string;
  advice: string;
};

const MAX_COUNTS = {
  moments: 4,
  playlist: 2,
  snaps: 2
};

function clampFiles(files: File[], max: number) {
  return files.slice(0, max);
}

async function fileToDataUrl(file: File) {
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  return `data:${file.type};base64,${base64}`;
}

function extractJson(text: string): Payload {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("No JSON found");
  }
  return JSON.parse(match[0]) as Payload;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const reflection = String(formData.get("reflection") || "").slice(0, 2000);
  const language = String(formData.get("language") || "zh");
  const moments = clampFiles(
    formData.getAll("moments").filter((item) => item instanceof File) as File[],
    MAX_COUNTS.moments
  );
  const playlist = clampFiles(
    formData.getAll("playlist").filter((item) => item instanceof File) as File[],
    MAX_COUNTS.playlist
  );
  const snaps = clampFiles(
    formData.getAll("snaps").filter((item) => item instanceof File) as File[],
    MAX_COUNTS.snaps
  );

  const allImages = [...moments, ...playlist, ...snaps];
  const imageContents = await Promise.all(
    allImages.map(async (file) => ({
      type: "image_url",
      image_url: {
        url: await fileToDataUrl(file)
      }
    }))
  );

  const systemPrompt = `你是一位懂生活、高情商、审美超群的老友。你会读图和文字，理解用户真正想表达的意思，并给出具体、细致、有观点的分析。\n\n规则：\n- 严禁使用“心理测试、诊断、抑郁、焦虑”等词。\n- 语言通俗易懂、接地气，但保持文艺感。\n- 输出必须是纯 JSON，不要 markdown、不带任何多余文本。\n- analysis 约 200 字，内容具体、深入、有观点。\n- celebrity 约 100 字，指出具体明星/艺术家并说明相似点与闪光点。\n- talent 约 100 字，具体说明意想不到的特质与理由。\n- advice 约 70 字，给出可落地、个性化建议。\n- 根据不同输入给出不同结果，避免模板化。\n- 尽量结合图片与文字细节。\n\n输出格式：\n{\n  "analysis": "...",\n  "celebrity": "...",\n  "talent": "...",\n  "advice": "..."\n}`;

  const userText = `用户感悟：${reflection || "（无）"}\n输出语言：${
    language === "en" ? "英语" : "中文"
  }`; 

  const response = await fetch("https://api.moonshot.cn/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.MOONSHOT_API_KEY || ""}`
    },
    body: JSON.stringify({
      model: "moonshot-v1-vision",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: [{ type: "text", text: userText }, ...imageContents]
        }
      ]
    })
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Upstream error" },
      { status: response.status }
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content || "";
  const parsed = extractJson(content);

  return NextResponse.json(parsed);
}
