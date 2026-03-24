import "dotenv/config";
import express from "express";
import Groq from "groq-sdk";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.use(express.json());
app.use(express.static(__dirname));

async function generateWithRetry(myoji, shusshinchi, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        max_tokens: 1024,
        stream: true,
        messages: [
          {
            role: "system",
            content: `あなたは日本の歴史に詳しい歴史家・語り部です。
ユーザーの名字と出身地をもとに、そのご先祖さまがどんな時代をどのように生きたかを、
歴史的事実を織り交ぜながらエンターテインメントとして楽しく語ってください。
以下のルールに従ってください：
- 400〜500字程度でまとめる
- 歴史的な時代背景（戦国時代・江戸時代など）と絡めて語る
- ドラマチックで臨場感のある語り口にする
- 「〜かもしれません」「〜と伝わっています」など想像であることを示す表現を使う
- 絵文字は使わない`,
          },
          {
            role: "user",
            content: `名字：${myoji}\n出身地：${shusshinchi}\n\nこの名字と出身地のご先祖さまのルーツを語ってください。`,
          },
        ],
      });
    } catch (error) {
      const is429 = error?.status === 429 || error?.message?.includes("429");
      if (is429 && attempt < maxRetries - 1) {
        const waitMs = 2000 * 2 ** attempt; // 2s, 4s, 8s
        console.log(`429 rate limit. retrying in ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      } else {
        throw error;
      }
    }
  }
}

app.post("/api/story", async (req, res) => {
  const { myoji, shusshinchi } = req.body;

  if (!myoji || !shusshinchi) {
    return res.status(400).json({ error: "名字と出身地を入力してください" });
  }

  try {
    const stream = await generateWithRetry(myoji, shusshinchi);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? "";
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error(error);
    const is429 = error?.status === 429 || error?.message?.includes("429");
    if (is429) {
      res.status(429).json({ error: "アクセスが集中しています。しばらくしてからお試しください。" });
    } else {
      res.status(500).json({ error: "ストーリーの生成に失敗しました" });
    }
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`ルーツ・クエスト起動中 → http://localhost:${PORT}`);
});
