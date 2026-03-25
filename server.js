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
app.get("/", (req, res) => res.sendFile(__dirname + "/public/index.html"));

const CHARACTER_TYPES = {
  warrior:       { emoji: '🐕', typeName: '柴犬の武神',         typeDesc: '勇気・忠義をつかさどる守護獣',       isRare: false },
  ninja:         { emoji: '🐱', typeName: '黒猫の忍神',         typeDesc: '俊敏・秘密をつかさどる守護獣',       isRare: true  },
  court_noble:   { emoji: '🐇', typeName: '白うさぎの雅神',     typeDesc: '美・気品をつかさどる守護獣',         isRare: false },
  farmer:        { emoji: '🦝', typeName: 'たぬきの豊穣神',     typeDesc: '豊作・大地をつかさどる守護獣',       isRare: false },
  shugenja:      { emoji: '🦌', typeName: 'しかの霊験神',       typeDesc: '神秘・霊力をつかさどる守護獣',       isRare: true  },
  craftsman:     { emoji: '🐱', typeName: '三毛猫の匠神',       typeDesc: '器用・創造をつかさどる守護獣',       isRare: false },
  merchant:      { emoji: '🐼', typeName: 'パンダの商才神',     typeDesc: '知恵・金運をつかさどる守護獣',       isRare: false },
  seafarer:      { emoji: '🐧', typeName: 'ペンギンの海神',     typeDesc: '冒険・自由をつかさどる守護獣',       isRare: false },
  scholar:       { emoji: '🐹', typeName: 'ハムスターの仏神',   typeDesc: '信心・慈悲をつかさどる守護獣',       isRare: false },
  healer:        { emoji: '🦊', typeName: 'きつねの陰陽神',     typeDesc: '知恵・神秘をつかさどる守護獣',       isRare: false },
  hunter:        { emoji: '🐻', typeName: 'くまのマタギ神',     typeDesc: '自然・直感をつかさどる守護獣',       isRare: false },
  trader:        { emoji: '🐿', typeName: 'りすの速神',         typeDesc: '素早さ・誠実をつかさどる守護獣',     isRare: false },
  performer:     { emoji: '🦉', typeName: 'ふくろうの長老神',   typeDesc: '学問・洞察をつかさどる守護獣',       isRare: false },
  weaver:        { emoji: '🐸', typeName: 'かえるの芸神',       typeDesc: '魅力・表現をつかさどる守護獣',       isRare: false },
  mountain_folk: { emoji: '🐒', typeName: 'さるの祭神',         typeDesc: '陽気・縁起をつかさどる守護獣',       isRare: false },
  christian:     { emoji: '🦦', typeName: 'かわうその川神',     typeDesc: '誠実・奉仕をつかさどる守護獣',       isRare: false },
  blacksmith:    { emoji: '🐗', typeName: 'いのししの守神',     typeDesc: '力強さ・守護をつかさどる守護獣',     isRare: false },
  tea_master:    { emoji: '🐨', typeName: 'コアラの風雅神',     typeDesc: '侘び寂び・癒しをつかさどる守護獣',   isRare: false },
  castle_samurai:{ emoji: '🐘', typeName: 'ぞうの縁神',         typeDesc: '縁・繁栄をつかさどる守護獣',         isRare: false },
  noble_exile:   { emoji: '🐉', typeName: 'たつの龍神',         typeDesc: '天地万物をつかさどる伝説の守護獣',   isRare: true  },
};

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
- 130〜160字程度のドラマチックな短文（3行で読み切れる長さ）
- 歴史的な時代背景（戦国時代・江戸時代など）と絡めて語る
- ドラマチックで熱く、読んで興奮するような語り口にする
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

    const SPECIAL_TOKENS = /<\|[^|>]*\|>/g;
    let pendingBuf = '';
    for await (const chunk of stream) {
      const raw = chunk.choices[0]?.delta?.content ?? "";
      if (!raw) continue;
      pendingBuf += raw;
      // 末尾に未完了の特殊トークンがある場合は保留
      const lt = pendingBuf.lastIndexOf('<|');
      let safe, hold;
      if (lt !== -1 && pendingBuf.indexOf('|>', lt) === -1) {
        safe = pendingBuf.slice(0, lt);
        hold = pendingBuf.slice(lt);
      } else {
        safe = pendingBuf;
        hold = '';
      }
      const text = safe.replace(SPECIAL_TOKENS, '');
      if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
      pendingBuf = hold;
    }
    if (pendingBuf) {
      const text = pendingBuf.replace(SPECIAL_TOKENS, '');
      if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
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

app.post("/api/character", async (req, res) => {
  const { myoji, shusshinchi, story } = req.body;
  if (!myoji || !shusshinchi || !story) {
    return res.status(400).json({ error: "必要な情報が不足しています" });
  }
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 512,
      stream: false,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `あなたは動物の守護獣を呼び出す、やさしい神秘の占い師です。
名字・出身地・ご先祖のストーリーをもとに、以下20種類の守護獣タイプから最も適切なものを1つ選んでください。
JSON形式のみで返してください。

守護獣タイプ（key）：
warrior（柴犬武神）, ninja（黒猫忍神・レア）, court_noble（白うさぎ雅神）, farmer（たぬき豊穣神）,
shugenja（しか霊験神・レア）, craftsman（三毛猫匠神）, merchant（パンダ商才神）, seafarer（ペンギン海神）,
scholar（ハムスター仏神）, healer（きつね陰陽神）, hunter（くまマタギ神）, trader（りす速神）,
performer（ふくろう長老神）, weaver（かえる芸神）, mountain_folk（さる祭神）,
christian（かわうそ川神）, blacksmith（いのしし守神）, tea_master（コアラ風雅神）,
castle_samurai（ぞう縁神）, noble_exile（たつ龍神・レア）

返すJSONの形式：
{
  "key": "上記のkeyから1つ",
  "ancestorName": "名字や地域・動物を活かした守護獣の名前（例：陸奥の柴犬武神・鉄三郎権現）",
  "feature": "この守護獣の由来と特徴を2〜3文で。ご先祖の時代背景・ご加護の内容を含めてください。",
  "comment": "守護獣からあなたへの温かいひとこと。やさしく励ますような語り口で（40字程度）"
}`,
        },
        {
          role: "user",
          content: `名字：${myoji}\n出身地：${shusshinchi}\n\nストーリー：\n${story}`,
        },
      ],
    });

    const raw = JSON.parse(completion.choices[0].message.content);
    const typeInfo = CHARACTER_TYPES[raw.key] || CHARACTER_TYPES.farmer;

    res.json({
      key: raw.key,
      emoji: typeInfo.emoji,
      typeName: typeInfo.typeName,
      typeDesc: typeInfo.typeDesc,
      isRare: typeInfo.isRare,
      ancestorName: raw.ancestorName,
      feature: raw.feature,
      comment: raw.comment,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "キャラクター判定に失敗しました" });
  }
});

app.post("/api/nameroot", async (req, res) => {
  const { myoji } = req.body;
  if (!myoji) return res.status(400).json({ error: "名字を入力してください" });
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 400,
      stream: false,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `あなたは日本の名字の歴史に詳しい研究者です。
入力された名字の由来・発祥地・歴史的背景を調査し、以下のJSON形式のみで返してください：
{
  "origin": "名字の由来を2〜3文で簡潔に",
  "birthplace": "発祥地・主な分布地域（都道府県・地方名）",
  "era": "主に広まった・活躍した歴史的時代",
  "meaning": "名字に込められた意味や漢字の解説（1〜2文）"
}
事実に基づき、不明な場合は「諸説あります」などと記してください。`,
        },
        { role: "user", content: `名字：${myoji}` },
      ],
    });
    res.json(JSON.parse(completion.choices[0].message.content));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "名字ルーツの取得に失敗しました" });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`ルーツ・クエスト起動中 → http://localhost:${PORT}`);
});
