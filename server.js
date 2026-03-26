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

// 名字+出身地のハッシュで守護獣タイプを決定論的に選ぶフォールバック
function hashType(myoji, shusshinchi) {
  const s = myoji + shusshinchi;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  const keys = Object.keys(CHARACTER_TYPES);
  return keys[h % keys.length];
}

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
          content: `あなたは守護獣を判定する神秘の占い師です。
名字・出身地・ご先祖のストーリーをもとに、以下20種類の守護獣タイプから最も適切なものを厳密に1つ選んでください。
JSON形式のみで返してください。

【守護獣の選び方：ストーリーのキーワードで判断する】
- 田畑・農業・豊作・里山の暮らし → farmer（たぬきの豊穣神）
- 武士・合戦・刀・剣術・忠義 → warrior（柴犬の武神）
- 忍び・隠密・スパイ・秘密工作 → ninja（黒猫の忍神）★レア
- 公家・朝廷・宮廷・雅楽・和歌 → court_noble（白うさぎの雅神）
- 修験道・山岳修行・呪術・霊山 → shugenja（しかの霊験神）★レア
- 大工・左官・建築・木工・鍛冶以外の職人 → craftsman（三毛猫の匠神）
- 商売・両替・問屋・市場・行商 → merchant（パンダの商才神）
- 海・漁・船乗り・漁村・港 → seafarer（ペンギンの海神）
- 寺・仏教・僧侶・念仏・写経 → scholar（ハムスターの仏神）
- 陰陽師・呪い・占い・神道・神社神職 → healer（きつねの陰陽神）
- 山・猟・狩り・マタギ・山村 → hunter（くまのマタギ神）
- 飛脚・早馬・使者・旅・行商の旅人 → trader（りすの速神）
- 長老・学者・医者・儒学・書物 → performer（ふくろうの長老神）
- 歌舞伎・能・芸能・踊り・祭り芸 → weaver（かえるの芸神）
- 祭り・神輿・太鼓・民俗行事 → mountain_folk（さるの祭神）
- 川・渡し舟・水運・船頭・漁師（川） → christian（かわうその川神）
- 鍛冶・製鉄・炭焼き・衛兵・門番 → blacksmith（いのししの守神）
- 茶道・華道・文人・文化人・茶人 → tea_master（コアラの風雅神）
- 貿易商・異国・琉球・長崎・外国との縁 → castle_samurai（ぞうの縁神）
- 大名・伝説・龍・神話・極めて特殊な血筋 → noble_exile（たつの龍神）★レア

【重要】
・必ず上記20種類のkeyを1つだけ返してください
・「warrior」は武士・剣士の話のみ。農民や商人には使わないでください
・ストーリーに複数の要素がある場合は、最も強調されているものを選んでください

返すJSONの形式：
{
  "key": "上記20種類のkeyから1つ（例：farmer, merchant, ninja など）",
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
    // 有効なkeyかチェック。無効ならハッシュフォールバック
    const resolvedKey = CHARACTER_TYPES[raw.key] ? raw.key : hashType(myoji, shusshinchi);
    const typeInfo = CHARACTER_TYPES[resolvedKey];

    res.json({
      key: resolvedKey,
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

// ── 歴史IFストーリー ──
app.post("/api/ifstory", async (req, res) => {
  const { myoji, shusshinchi, charKey, typeName } = req.body;
  if (!myoji || !shusshinchi || !charKey) {
    return res.status(400).json({ error: "必要な情報が不足しています" });
  }
  try {
    const stream = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 700,
      stream: true,
      messages: [
        {
          role: "system",
          content: `あなたは日本の歴史に精通した幻想的な語り部です。
ユーザーの名字・出身地・先祖タイプをもとに、歴史のIFストーリーを一段落で生成してください。

【必須ルール】
- 200〜260字程度の濃密な一段落
- 「あなたの先祖は、」で始める
- 有名な歴史的事件・人物（関ヶ原の戦い・本能寺の変・大塩平八郎の乱・西南戦争・明治維新・桶狭間の戦い・赤穂事件など）に1〜2つ絞って絡める
- 「〜だったかもしれません」「〜していた可能性があります」「〜と伝わっています」の表現を必ず使う
- 断定は絶対にしない。あくまで「かもしれない」トーンを貫く
- 読んでいてゾクッとするような歴史の分岐点・秘密の関与・知られざる役割を描く
- 絵文字は使わない`,
        },
        {
          role: "user",
          content: `名字：${myoji}\n出身地：${shusshinchi}\n先祖タイプ：${typeName}`,
        },
      ],
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const SPECIAL_TOKENS = /<\|[^|>]*\|>/g;
    let pendingBuf = '';
    for await (const chunk of stream) {
      const raw = chunk.choices[0]?.delta?.content ?? "";
      if (!raw) continue;
      pendingBuf += raw;
      const lt = pendingBuf.lastIndexOf('<|');
      let safe, hold;
      if (lt !== -1 && pendingBuf.indexOf('|>', lt) === -1) {
        safe = pendingBuf.slice(0, lt); hold = pendingBuf.slice(lt);
      } else {
        safe = pendingBuf; hold = '';
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
    res.status(500).json({ error: "歴史IFストーリーの生成に失敗しました" });
  }
});

// ── 名字ヒートマップ: 都道府県別分布スクレイピング ──
const ALL_PREFECTURES = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県",
  "静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県",
  "奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県",
  "熊本県","大分県","宮崎県","鹿児島県","沖縄県",
];

const SCRAPE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "ja,en-US;q=0.9",
  "Referer": "https://myoji-yurai.net/",
};

async function fetchPrefectureCount(myoji, pref) {
  try {
    const url = `https://myoji-yurai.net/myojiPrefectureDetail.htm?myojiKanji=${encodeURIComponent(myoji)}&prefecture=${encodeURIComponent(pref)}`;
    const r = await fetch(url, { headers: SCRAPE_HEADERS });
    if (!r.ok) return null;
    const html = await r.text();
    const m = html.match(/【.+?人数】\s*[\r\n]*およそ([\d,]+)人/);
    return m ? parseInt(m[1].replace(/,/g, ""), 10) : null;
  } catch {
    return null;
  }
}

app.get("/api/heatmap", async (req, res) => {
  const { myoji } = req.query;
  if (!myoji) return res.status(400).json({ error: "名字を入力してください" });
  try {
    const counts = await Promise.all(
      ALL_PREFECTURES.map(pref => fetchPrefectureCount(myoji, pref))
    );
    const prefectures = {};
    ALL_PREFECTURES.forEach((pref, i) => {
      if (counts[i] != null) prefectures[pref] = counts[i];
    });
    if (Object.keys(prefectures).length === 0) {
      return res.status(404).json({ error: "データが見つかりませんでした。名字を確認してください。" });
    }
    res.json({ myoji, prefectures });
  } catch (e) {
    console.error("heatmap error:", e);
    res.status(500).json({ error: "データ取得に失敗しました" });
  }
});

// ── Japan GeoJSON プロキシ（CORS回避・メモリキャッシュ） ──
let _japanGeoJSON = null;
app.get("/api/japan-geojson", async (req, res) => {
  try {
    if (!_japanGeoJSON) {
      const r = await fetch(
        "https://raw.githubusercontent.com/dataofjapan/land/master/japan.geojson"
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      _japanGeoJSON = await r.json();
    }
    res.json(_japanGeoJSON);
  } catch (e) {
    console.error("geojson error:", e);
    res.status(500).json({ error: "地図データの取得に失敗しました" });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`ルーツ・クエスト起動中 → http://localhost:${PORT}`);
});
