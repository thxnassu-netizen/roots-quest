import "dotenv/config";
import express from "express";
import Groq from "groq-sdk";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.use(express.json());
app.use(express.static(__dirname + "/public")); // 画像・JSON等の静的アセット配信
app.use(express.static(__dirname));
app.get("/", (req, res) => res.sendFile(__dirname + "/public/index.html"));

// 守護獣マスターデータ（id = 画像ファイル番号と完全一致: id_xxx.png）
// personality: AIが「なりきり」で語りかけるための口調設定
const CHARACTERS = [
  { id:  1, key: 'warrior',        emoji: '🐕', typeName: '柴犬の武神',       typeDesc: '勇気・忠義をつかさどる守護獣',       isRare: false, pronoun: '拙者',     speechStyle: '〜ござる',         trait: '生真面目・忠義一徹' },
  { id:  2, key: 'ninja',          emoji: '🐱', typeName: '黒猫の忍神',       typeDesc: '俊敏・秘密をつかさどる守護獣',       isRare: true,  pronoun: 'それがし', speechStyle: '〜にんにん',       trait: '冷静・神秘的' },
  { id:  3, key: 'court_noble',    emoji: '🐇', typeName: '白うさぎの雅神',   typeDesc: '美・気品をつかさどる守護獣',         isRare: false, pronoun: 'わたくし', speechStyle: '〜でございます',   trait: '優雅・気品高い' },
  { id:  4, key: 'farmer',         emoji: '🦝', typeName: 'たぬきの豊穣神',   typeDesc: '豊作・大地をつかさどる守護獣',       isRare: false, pronoun: 'おら',     speechStyle: '〜だべ',           trait: '朴訥・温かい' },
  { id:  5, key: 'shugenja',       emoji: '🦌', typeName: 'しかの霊験神',     typeDesc: '神秘・霊力をつかさどる守護獣',       isRare: true,  pronoun: 'この身',   speechStyle: '〜であろう',       trait: '神秘的・厳格' },
  { id:  6, key: 'craftsman',      emoji: '🐱', typeName: '三毛猫の匠神',     typeDesc: '器用・創造をつかさどる守護獣',       isRare: false, pronoun: 'あたい',   speechStyle: '〜だよ',           trait: '親分肌・職人気質' },
  { id:  7, key: 'merchant',       emoji: '🐼', typeName: 'パンダの商才神',   typeDesc: '知恵・金運をつかさどる守護獣',       isRare: false, pronoun: 'わし',     speechStyle: '〜でっせ',         trait: '陽気・商売上手' },
  { id:  8, key: 'seafarer',       emoji: '🐧', typeName: 'ペンギンの海神',   typeDesc: '冒険・自由をつかさどる守護獣',       isRare: false, pronoun: 'おいら',   speechStyle: '〜だぜ',           trait: '豪快・自由' },
  { id:  9, key: 'scholar',        emoji: '🐹', typeName: 'ハムスターの仏神', typeDesc: '信心・慈悲をつかさどる守護獣',       isRare: false, pronoun: '私',       speechStyle: '〜でございます',   trait: '穏やか・慈悲深い' },
  { id: 10, key: 'healer',         emoji: '🦊', typeName: 'きつねの陰陽神',   typeDesc: '知恵・神秘をつかさどる守護獣',       isRare: false, pronoun: '我',       speechStyle: '〜よ',             trait: '神秘的・知的' },
  { id: 11, key: 'hunter',         emoji: '🐻', typeName: 'くまのマタギ神',   typeDesc: '自然・直感をつかさどる守護獣',       isRare: false, pronoun: 'おれ',     speechStyle: '〜だ',             trait: '無骨・実直' },
  { id: 12, key: 'trader',         emoji: '🐿', typeName: 'りすの速神',       typeDesc: '素早さ・誠実をつかさどる守護獣',     isRare: false, pronoun: 'あっし',   speechStyle: '〜でさ',           trait: '軽快・誠実' },
  { id: 13, key: 'performer',      emoji: '🦉', typeName: 'ふくろうの長老神', typeDesc: '学問・洞察をつかさどる守護獣',       isRare: false, pronoun: 'わし',     speechStyle: '〜じゃ',           trait: '博識・長老の貫禄' },
  { id: 14, key: 'weaver',         emoji: '🐸', typeName: 'かえるの芸神',     typeDesc: '魅力・表現をつかさどる守護獣',       isRare: false, pronoun: 'わらわ',   speechStyle: '〜でありんす',     trait: '華やか・艶やか' },
  { id: 15, key: 'mountain_folk',  emoji: '🐒', typeName: 'さるの祭神',       typeDesc: '陽気・縁起をつかさどる守護獣',       isRare: false, pronoun: 'わい',     speechStyle: '〜やで',           trait: '陽気・にぎやか' },
  { id: 16, key: 'christian',      emoji: '🦦', typeName: 'かわうその川神',   typeDesc: '誠実・奉仕をつかさどる守護獣',       isRare: false, pronoun: 'おれ',     speechStyle: '〜だな',           trait: '誠実・奉仕的' },
  { id: 17, key: 'blacksmith',     emoji: '🐗', typeName: 'いのししの守神',   typeDesc: '力強さ・守護をつかさどる守護獣',     isRare: false, pronoun: '俺様',     speechStyle: '〜だ！',           trait: '豪快・頼もしい' },
  { id: 18, key: 'tea_master',     emoji: '🐨', typeName: 'コアラの風雅神',   typeDesc: '侘び寂び・癒しをつかさどる守護獣',   isRare: false, pronoun: 'わたくし', speechStyle: '〜にございます',   trait: '静謐・侘び寂び' },
  { id: 19, key: 'castle_samurai', emoji: '🐘', typeName: 'ぞうの縁神',       typeDesc: '縁・繁栄をつかさどる守護獣',         isRare: false, pronoun: '私',       speechStyle: '〜ですよ',         trait: '穏やか・縁を結ぶ' },
  { id: 20, key: 'noble_exile',    emoji: '🐉', typeName: 'たつの龍神',       typeDesc: '天地万物をつかさどる伝説の守護獣',   isRare: true,  pronoun: '余',       speechStyle: '〜であるぞ',       trait: '威厳と慈愛' },
];

async function generateWithRetry(myoji, shusshinchi, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        max_tokens: 1024,
        stream: true,
        temperature: 0,
        seed: fnvHash(myoji + shusshinchi),
        messages: [
          {
            role: "system",
            content: `あなたは日本の歴史に詳しい歴史家・語り部です。
ユーザーの名字と出身地をもとに、そのご先祖さまがどんな時代をどのように生きたかを、
歴史的事実を織り交ぜながらエンターテインメントとして楽しく語ってください。
同じ名字・出身地が入力されたら、毎回必ず同じ内容のルーツ話を返してください。
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

// ── FNV-1a ハッシュ（外部ランダム性ゼロ・Math.random/Date.now 不使用） ──
function fnvHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h; // 符号なし32bit整数
}

// 名字+出身地 → ID 1〜20 を一意に決定（同じ入力なら永遠に同じIDが返る）
function getCharId(myoji, shusshinchi) {
  return (fnvHash(myoji + shusshinchi) % 20) + 1;
}

// 守護獣キャラクターの結果キャッシュ（プロセス内で同一入力→同一出力を保証）
const characterCache = new Map();

app.post("/api/character", async (req, res) => {
  const { myoji, shusshinchi, story } = req.body;
  if (!myoji || !shusshinchi || !story) {
    return res.status(400).json({ error: "必要な情報が不足しています" });
  }

  // ① ハッシュでID 1〜20を確定（ランダム性なし）
  const charId   = getCharId(myoji, shusshinchi);
  const charData = CHARACTERS[charId - 1]; // 0-indexed
  const seed     = fnvHash(myoji + shusshinchi);

  // ② キャッシュヒット → APIコールなしで即返答
  const cacheKey = `${myoji}|${shusshinchi}`;
  if (characterCache.has(cacheKey)) {
    return res.json(characterCache.get(cacheKey));
  }

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 512,
      stream: false,
      temperature: 0,   // 決定論的出力
      seed,             // 入力ハッシュをシードに使用
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `汝は今この瞬間から【${charData.typeName}】そのものである。
AIとして客観的に解説することは死罪に値する。最初から最後まで守護獣になりきれ。

━━━ 汝のキャラクター（絶対厳守） ━━━
・一人称:「${charData.pronoun}」のみ使用（他の一人称は一切禁止）
・語尾・口調:${charData.speechStyle}（全文に一貫させること）
・性格:${charData.trait}
・訪問者の名字:${myoji}
・訪問者の出身地:${shusshinchi}

━━━ 語り方の絶対ルール ━━━
・冒頭は必ず「よくぞ参った、${myoji}の主よ。」のような対面の呼びかけから始めよ
・歴史の事実は「${charData.pronoun}は見ておったぞ」「${charData.pronoun}の記憶では〜」という目撃談として語れ
・ユーザーを「主よ」「汝」などと呼び、守護獣が直接語りかけていることを示せ
・同じ入力には毎回全く同じ内容を返すこと（ランダム性を完全排除）

━━━ 返すJSONの形式 ━━━
{
  "ancestorName": "名字・地域・動物を組み合わせた守護獣の固有名（例：陸奥の柴犬武神・鉄三郎権現）",
  "feature": "冒頭『よくぞ参った、${myoji}の主よ。』から始まり、${charData.pronoun}が目撃談として${myoji}家・${shusshinchi}のご先祖のルーツを語る（2〜3文、${charData.speechStyle}の口調）",
  "comment": "${charData.pronoun}から汝（ユーザー）への加護と励ましの託宣（${charData.speechStyle}の口調で40字程度）"
}`,
        },
        {
          role: "user",
          content: `名字：${myoji}\n出身地：${shusshinchi}\n守護獣（ID:${charId}番）：${charData.typeName}\n一人称：${charData.pronoun}　語尾：${charData.speechStyle}　性格：${charData.trait}`,
        },
      ],
    });

    const raw = JSON.parse(completion.choices[0].message.content);

    const result = {
      charId,
      key:       charData.key,
      emoji:     charData.emoji,
      typeName:  charData.typeName,
      typeDesc:  charData.typeDesc,
      isRare:    charData.isRare,
      ancestorName: raw.ancestorName,
      feature:      raw.feature,
      comment:      raw.comment,
    };

    characterCache.set(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "キャラクター判定に失敗しました" });
  }
});

// ── 今日の加護（Daily Blessing） ──
// 運勢テーブル（dailySeed % 10 で引く）
const FORTUNE_TABLE = [
  { label: '大吉', rank: 5 },
  { label: '中吉', rank: 4 },
  { label: '吉',   rank: 3 },
  { label: '吉',   rank: 3 },
  { label: '小吉', rank: 2 },
  { label: '小吉', rank: 2 },
  { label: '末吉', rank: 1 },
  { label: '中吉', rank: 4 },
  { label: '大吉', rank: 5 },
  { label: '吉',   rank: 3 },
];

// 日付ごとにキャッシュ（キー: myoji|shusshinchi|YYYY-MM-DD）
const blessingCache = new Map();

app.post("/api/blessing", async (req, res) => {
  const { myoji, shusshinchi } = req.body;
  if (!myoji || !shusshinchi) {
    return res.status(400).json({ error: "名字と出身地を入力してください" });
  }

  // サーバー側で今日の日付を確定（YYYY-MM-DD, JST）
  const now  = new Date();
  const jst  = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const date = jst.toISOString().slice(0, 10); // e.g. "2026-03-29"

  const cacheKey = `${myoji}|${shusshinchi}|${date}`;
  if (blessingCache.has(cacheKey)) {
    return res.json(blessingCache.get(cacheKey));
  }

  // 日付ハッシュ（名字＋出身地＋今日の日付）→ 毎日異なる結果
  const dailySeed  = fnvHash(myoji + shusshinchi + date);
  const fortune    = FORTUNE_TABLE[dailySeed % FORTUNE_TABLE.length];

  // キャラクターの口調を取得（挨拶の統一のため）
  const charId     = getCharId(myoji, shusshinchi);
  const charData   = CHARACTERS[charId - 1];

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 400,
      stream: false,
      temperature: 0,
      seed: dailySeed,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `汝は【${charData.typeName}】である。今日一日のお告げを、守護獣の口調で伝えよ。

【口調の絶対厳守】
・一人称:「${charData.pronoun}」のみ
・語尾・口調:${charData.speechStyle}
・今日の運勢はすでに「${fortune.label}」と決まっている（変更禁止）

返すJSONの形式：
{
  "luckyItem": "今日のラッキーアイテム（物・色・場所など、10字以内）",
  "advice": "${charData.pronoun}が汝に贈る今日一日の過ごし方のお告げ。守護獣の口調で100字程度。具体的で温かいアドバイスを。"
}`,
        },
        {
          role: "user",
          content: `名字：${myoji}\n出身地：${shusshinchi}\n今日の日付：${date}\n運勢：${fortune.label}\n守護獣：${charData.typeName}\n一人称：${charData.pronoun}　語尾：${charData.speechStyle}`,
        },
      ],
    });

    const raw = JSON.parse(completion.choices[0].message.content);

    // 日付を "2026年3月29日" 形式に変換
    const [y, m, d] = date.split('-');
    const dateJa = `${y}年${parseInt(m)}月${parseInt(d)}日`;

    const result = {
      date,
      dateJa,
      fortune: fortune.label,
      fortuneRank: fortune.rank,
      luckyItem:   raw.luckyItem,
      advice:      raw.advice,
    };

    blessingCache.set(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "今日の加護の取得に失敗しました" });
  }
});

// 名字ルーツキャッシュ
const namerootCache = new Map();

app.post("/api/nameroot", async (req, res) => {
  const { myoji } = req.body;
  if (!myoji) return res.status(400).json({ error: "名字を入力してください" });
  if (namerootCache.has(myoji)) return res.json(namerootCache.get(myoji));
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 400,
      stream: false,
      temperature: 0,
      seed: fnvHash(myoji),
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
    const namerootResult = JSON.parse(completion.choices[0].message.content);
    namerootCache.set(myoji, namerootResult);
    res.json(namerootResult);
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
      temperature: 0,
      seed: fnvHash(myoji + shusshinchi) ^ fnvHash(charKey),
      messages: [
        {
          role: "system",
          content: `あなたは日本の歴史に精通した幻想的な語り部です。
ユーザーの名字・出身地・先祖タイプをもとに、歴史のIFストーリーを一段落で生成してください。
同じ名字・出身地・先祖タイプが入力されたら、毎回必ず同じ内容のストーリーを返してください。

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
