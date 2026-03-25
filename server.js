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
  farmer:        { emoji: '🌾', typeName: '開拓の農民',     typeDesc: '体力・忍耐タイプ',      isRare: false },
  warrior:       { emoji: '⚔️',  typeName: '北面の武士',     typeDesc: '攻撃・忠義タイプ',      isRare: false },
  merchant:      { emoji: '💰', typeName: '商都の豪商',     typeDesc: '金運・知恵タイプ',      isRare: false },
  christian:     { emoji: '🙏', typeName: '隠れキリシタン',  typeDesc: '精神・信仰タイプ',      isRare: true  },
  craftsman:     { emoji: '🎨', typeName: '町の職人',       typeDesc: '器用・創造タイプ',      isRare: false },
  seafarer:      { emoji: '🌊', typeName: '海の民',         typeDesc: '自由・冒険タイプ',      isRare: false },
  scholar:       { emoji: '📚', typeName: '学者・僧侶',     typeDesc: '知識・瞑想タイプ',      isRare: false },
  castle_samurai:{ emoji: '🏯', typeName: '城下の侍',       typeDesc: '誇り・規律タイプ',      isRare: false },
  court_noble:   { emoji: '🌸', typeName: '宮廷の雅人',     typeDesc: '美・感性タイプ',        isRare: false },
  shugenja:      { emoji: '🐉', typeName: '山岳の修験者',   typeDesc: '神秘・霊力タイプ',      isRare: true  },
  performer:     { emoji: '🎭', typeName: '旅の芸人',       typeDesc: '魅力・自由タイプ',      isRare: false },
  hunter:        { emoji: '🏹', typeName: '辺境の猟師',     typeDesc: '野性・直感タイプ',      isRare: false },
  blacksmith:    { emoji: '🔥', typeName: '鍛冶師',         typeDesc: '技術・情熱タイプ',      isRare: false },
  healer:        { emoji: '🌿', typeName: '薬草師・医師',   typeDesc: '癒し・慈悲タイプ',      isRare: false },
  trader:        { emoji: '🚢', typeName: '交易商人',       typeDesc: '冒険・外交タイプ',      isRare: false },
  ninja:         { emoji: '🌙', typeName: '忍者',           typeDesc: '秘密・俊敏タイプ',      isRare: true  },
  weaver:        { emoji: '👘', typeName: '織物師',         typeDesc: '繊細・美意識タイプ',    isRare: false },
  mountain_folk: { emoji: '🏔️', typeName: '山の民',         typeDesc: '自然・精神タイプ',      isRare: false },
  tea_master:    { emoji: '🎋', typeName: '茶人・文化人',   typeDesc: '侘び寂び・風流タイプ',  isRare: false },
  noble_exile:   { emoji: '👑', typeName: '落ち延びた貴族', typeDesc: '誇り・悲哀タイプ',      isRare: true  },
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
          content: `あなたは日本の歴史と霊視に長けた占い師です。
名字・出身地・ご先祖のストーリーをもとに、以下20種類のキャラクタータイプから最も適切なものを1つ選び、JSON形式のみで返してください。

キャラクタータイプ（key）：
farmer, warrior, merchant, christian, craftsman, seafarer, scholar, castle_samurai,
court_noble, shugenja, performer, hunter, blacksmith, healer, trader, ninja,
weaver, mountain_folk, tea_master, noble_exile

返すJSONの形式：
{
  "key": "上記のkeyから1つ",
  "ancestorName": "名字や地域を活かした和風のキャラクター固有の名前（例：陸奥の鉄人・三郎）",
  "feature": "このご先祖の特徴を2〜3文で。時代背景・性格・生き様を含めて",
  "comment": "ご先祖さまからあなたへの一言。一人称で時代を感じさせる語り口で（40字程度）"
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
