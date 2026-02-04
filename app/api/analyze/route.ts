// ... 其他代码保持不变 ...

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const reflection = String(formData.get("reflection") || "").slice(0, 2000);
    const language = String(formData.get("language") || "zh");
    
    // ... 图片处理代码保持不变 ...

    // 修改 1: 移除提示词中的默认“沉默”文本，防止污染
    // 原来是：${reflection || "（对方保持了神秘的沉默）"}
    // 现在改为：如果为空，传一个中性描述，或者直接留空，不要让模型看到“沉默”二字
    const userReflectionText = reflection ? `用户感悟：${reflection}` : "用户没有提供额外的文字感悟，仅通过图片表达。";
    
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

// 修改 2: 明确告诉模型，输出必须是标准的 JSON 对象，不要有任何其他文字
输出必须是纯净的 JSON 对象，不要包含任何 Markdown 代码块标识（如 \`\`\`json），直接输出 JSON 字符串。`;

    const userText = `${userReflectionText}\n输出语言：${
      language === "en" ? "English" : "中文"
    }`;

    // 修改 3: 在请求体中添加 response_format，强制模型输出 JSON
    const response = await fetch("https://api.moonshot.cn/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MOONSHOT_API_KEY}`
      },
      body: JSON.stringify({
        model: "moonshot-v1-128k-vision-preview", 
        temperature: 0.81, 
        // --- 关键新增 ---
        response_format: { type: "json_object" }, 
        // --- 关键新增 ---
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
    const content = data.choices?.?.message?.content || "";

    // 修改 4: 移除脆弱的正则匹配，直接尝试解析
    // 因为我们开启了 response_format，content 应该已经是纯 JSON 字符串了
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      // 如果还是解析失败（理论上不应该，除非 API 出错），返回一个通用的错误，而不是包含“沉默”的错误
      console.error("JSON Parse Error:", parseError, content);
      return NextResponse.json({ 
        error: "解析失败", 
        analysis: "无法分析图片，请尝试上传更清晰或更具代表性的照片。", 
        celebrity: "暂无", 
        talent: "暂无", 
        advice: "换个角度拍照试试" 
      });
    }

    return NextResponse.json(parsed);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
