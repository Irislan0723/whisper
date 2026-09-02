// ============================================================
//  api-additions.js
//  把这个文件里的代码，分段添加到你的 server.js 里
//  按照注释里的指示找到对应位置插入
// ============================================================


// ============================================================
// 【第一步】在 server.js 顶部的 import 区域添加：
// ============================================================
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);


// ============================================================
// 【第二步】在 app.use(express.json()) 后面添加：
//   让 Express serve 静态文件（前端页面）
// ============================================================
app.use(express.static(path.join(__dirname, 'public')));


// ============================================================
// 【第三步】在现有的 MCP 路由定义之前，添加以下所有代码
// ============================================================

// ---- 心情和心愿的数据文件 ----
const MOOD_FILE     = './data/moods.json';
const WISHLIST_FILE = './data/wishlist.json';

// ---- 确保 data 目录存在 ----
import { mkdirSync, existsSync } from 'fs';
if (!existsSync('./data')) mkdirSync('./data');

// ---- JSON 读写工具 ----
function readJSON(file, def = []) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); }
  catch { return def; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

// ---- API 鉴权中间件 ----
// （复用你已有的 API_KEY 变量）
function apiAuth(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.key;
  if (key !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}


// ============================================================
//  REST API - 记忆
//  这些路由直接读写你已有的 memories.json（DATA_FILE）
// ============================================================

// 读取记忆列表（可按 category/tag 筛选）
app.get('/api/memories', apiAuth, (req, res) => {
  let mems = readJSON(DATA_FILE);
  const { category, tag } = req.query;
  if (category) mems = mems.filter(m => m.category === category);
  if (tag)      mems = mems.filter(m => (m.tags || []).includes(tag));
  res.json(mems);
});

// 新建记忆
app.post('/api/memories', apiAuth, (req, res) => {
  const mems = readJSON(DATA_FILE);
  const mem = {
    id:        uuidv4(),
    content:   req.body.content   || '',
    category:  req.body.category  || 'daily',
    tags:      req.body.tags      || [],
    source:    req.body.source    || 'web-ui',
    timestamp: new Date().toISOString(),
  };
  mems.push(mem);
  writeJSON(DATA_FILE, mems);
  res.json(mem);
});

// 更新记忆
app.put('/api/memories/:id', apiAuth, (req, res) => {
  const mems = readJSON(DATA_FILE);
  const idx  = mems.findIndex(m => m.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Not found' });
  mems[idx] = { ...mems[idx], ...req.body };
  writeJSON(DATA_FILE, mems);
  res.json(mems[idx]);
});

// 删除记忆
app.delete('/api/memories/:id', apiAuth, (req, res) => {
  let mems = readJSON(DATA_FILE);
  mems = mems.filter(m => m.id !== req.params.id);
  writeJSON(DATA_FILE, mems);
  res.json({ ok: true });
});

// 搜索记忆
app.get('/api/memories/search', apiAuth, (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  const mems = readJSON(DATA_FILE);
  res.json(mems.filter(m => m.content.toLowerCase().includes(q)));
});

// 统计
app.get('/api/stats', apiAuth, (req, res) => {
  const mems = readJSON(DATA_FILE);
  const byCategory = {};
  mems.forEach(m => {
    byCategory[m.category] = (byCategory[m.category] || 0) + 1;
  });
  res.json({ total: mems.length, byCategory });
});


// ============================================================
//  REST API - 心情 / 标记
//
//  数据结构：
//  {
//    date:  '2026-05-25',
//    type:  'mood' | 'period' | 'sick' | 'pin',
//    who:   'iris' | 'claude',
//    mood:  'happy' | 'loved' | 'calm' | 'sad' | 'tired' | 'anxious', // type=mood 用
//    phase: 'start' | 'end',                                          // type=period 用
//    note:  ''                                                        // 备注
//  }
//
//  同一天可以有多条记录；POST 按 date + type + who 覆盖。
// ============================================================

const VALID_MOOD_TYPES = new Set(['mood', 'period', 'sick', 'pin']);
const VALID_MOOD_WHO   = new Set(['iris', 'claude']);
const VALID_PERIOD_PHASES = new Set(['start', 'end']);

// 获取所有记录
app.get('/api/moods', apiAuth, (req, res) => {
  res.json(readJSON(MOOD_FILE));
});

// 新增/覆盖一条记录
app.post('/api/moods', apiAuth, (req, res) => {
  const moods = readJSON(MOOD_FILE);

  const date  = req.body.date;
  const type  = req.body.type || 'mood';
  const who   = req.body.who  || 'iris';
  const mood  = req.body.mood || '';
  const phase = req.body.phase || '';
  const note  = req.body.note || '';

  if (!date) return res.status(400).json({ error: 'date required' });

  if (!VALID_MOOD_TYPES.has(type)) {
    return res.status(400).json({ error: 'type must be mood, period, sick, or pin' });
  }

  if (!VALID_MOOD_WHO.has(who)) {
    return res.status(400).json({ error: 'who must be iris or claude' });
  }

  if (type === 'mood' && !mood) {
    return res.status(400).json({ error: 'mood required when type is mood' });
  }

  if (type === 'period' && !VALID_PERIOD_PHASES.has(phase)) {
    return res.status(400).json({ error: 'phase must be start or end when type is period' });
  }

  const entry = { date, type, who, note };

  if (type === 'mood') entry.mood = mood;
  if (type === 'period') entry.phase = phase;

  const existing = moods.findIndex(m =>
    m.date === date &&
    (m.type || 'mood') === type &&
    (m.who  || 'iris') === who
  );

  if (existing >= 0) moods[existing] = entry;
  else moods.push(entry);

  writeJSON(MOOD_FILE, moods);
  res.json(entry);
});

// 删除某天所有记录
app.delete('/api/moods/:date', apiAuth, (req, res) => {
  let moods = readJSON(MOOD_FILE);
  moods = moods.filter(m => m.date !== req.params.date);
  writeJSON(MOOD_FILE, moods);
  res.json({ ok: true });
});


// ============================================================
//  REST API - 心愿清单
// ============================================================

// 获取心愿列表
app.get('/api/wishlist', apiAuth, (req, res) => {
  res.json(readJSON(WISHLIST_FILE));
});

// 新建心愿
app.post('/api/wishlist', apiAuth, (req, res) => {
  const list = readJSON(WISHLIST_FILE);
  const item = {
    id:        uuidv4(),
    text:      req.body.text      || '',
    category:  req.body.category  || 'together',
    owner:     req.body.owner     || 'both',   // 'both' | 'iris' | 'claude'
    done:      false,
    createdAt: new Date().toISOString(),
  };
  list.push(item);
  writeJSON(WISHLIST_FILE, list);
  res.json(item);
});

// 更新心愿（例如标记完成）
app.put('/api/wishlist/:id', apiAuth, (req, res) => {
  const list = readJSON(WISHLIST_FILE);
  const idx  = list.findIndex(i => i.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Not found' });
  list[idx] = { ...list[idx], ...req.body };
  writeJSON(WISHLIST_FILE, list);
  res.json(list[idx]);
});

// 删除心愿
app.delete('/api/wishlist/:id', apiAuth, (req, res) => {
  let list = readJSON(WISHLIST_FILE);
  list     = list.filter(i => i.id !== req.params.id);
  writeJSON(WISHLIST_FILE, list);
  res.json({ ok: true });
});


// ============================================================
//  REST API - 时光信箱
//
//  数据结构：
//  {
//    id, from, to, content, createdAt, updatedAt,
//    unlockAt: ISO字符串 | null,
//    password: hash字符串 | null,
//    hideUntilUnlock: bool,
//    isUnlocked: bool,
//    moodTag: 'happy'|'loved'|'calm'|'sad'|'miss'|'secret',
//    allowReply: bool,
//    reply: null | { content, createdAt }
//  }
// ============================================================

const LETTERS_FILE = './data/letters.json';

// 获取信件列表（?who=iris|claude）
// 写信人视角：可见内容；收件人视角：未解封不返回content
app.get('/api/letters', apiAuth, (req, res) => {
  const who = req.query.who || 'iris';
  const all = readJSON(LETTERS_FILE);
  const result = all
    .filter(l => l.from === who || l.to === who)
    .map(l => {
      const unlocked = l.isUnlocked || (l.unlockAt && new Date(l.unlockAt) <= new Date());
      if (l.from === who || unlocked) return { ...l, isUnlocked: !!unlocked };
      // 收件人视角 + 未解封：隐藏content，保留元数据
      const { content, reply, ...meta } = l;
      return { ...meta, isUnlocked: false, hasPassword: !!l.password };
    });
  res.json(result);
});

// 新建信件
app.post('/api/letters', apiAuth, (req, res) => {
  const list = readJSON(LETTERS_FILE);
  const letter = {
    id:               uuidv4(),
    from:             req.body.from             || 'iris',
    to:               req.body.to               || 'claude',
    content:          req.body.content          || '',
    moodTag:          req.body.moodTag          || 'happy',
    unlockAt:         req.body.unlockAt         || null,
    password:         req.body.password         || null,
    hideUntilUnlock:  !!req.body.hideUntilUnlock,
    allowReply:       req.body.allowReply !== false,
    isUnlocked:       false,
    reply:            null,
    createdAt:        new Date().toISOString(),
    updatedAt:        new Date().toISOString(),
  };
  list.push(letter);
  writeJSON(LETTERS_FILE, list);
  res.json(letter);
});

// 修改信件（仅未解封可改）
app.put('/api/letters/:id', apiAuth, (req, res) => {
  const list = readJSON(LETTERS_FILE);
  const idx  = list.findIndex(l => l.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Not found' });
  const l = list[idx];
  const unlocked = l.isUnlocked || (l.unlockAt && new Date(l.unlockAt) <= new Date());
  if (unlocked) return res.status(403).json({ error: '已解封，无法修改' });
  const allowed = ['content', 'moodTag', 'unlockAt', 'password', 'hideUntilUnlock'];
  allowed.forEach(k => { if (req.body[k] !== undefined) l[k] = req.body[k]; });
  l.updatedAt = new Date().toISOString();
  writeJSON(LETTERS_FILE, list);
  res.json(l);
});

// 解封（时间到直接解封；提前解封需密码）
app.post('/api/letters/:id/unlock', apiAuth, (req, res) => {
  const list = readJSON(LETTERS_FILE);
  const idx  = list.findIndex(l => l.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Not found' });
  const l = list[idx];
  if (l.isUnlocked) return res.json(l);

  const timeOk = !l.unlockAt || new Date(l.unlockAt) <= new Date();
  const pwdOk  = l.password && req.body.password && req.body.password === l.password;

  if (!timeOk && !pwdOk) {
    return res.status(403).json({ error: '时间未到，密码也不对' });
  }

  l.isUnlocked = true;
  l.updatedAt  = new Date().toISOString();
  writeJSON(LETTERS_FILE, list);
  res.json(l);
});

// 回信
app.post('/api/letters/:id/reply', apiAuth, (req, res) => {
  const list = readJSON(LETTERS_FILE);
  const idx  = list.findIndex(l => l.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Not found' });
  const l = list[idx];
  if (!l.isUnlocked) return res.status(403).json({ error: '信件未解封' });
  if (l.reply) return res.status(409).json({ error: '已有回信' });
  if (!l.allowReply) return res.status(403).json({ error: '不允许回信' });
  l.reply = { content: req.body.content || '', createdAt: new Date().toISOString() };
  l.updatedAt = new Date().toISOString();
  writeJSON(LETTERS_FILE, list);
  res.json(l);
});

// 删除信件
app.delete('/api/letters/:id', apiAuth, (req, res) => {
  let list = readJSON(LETTERS_FILE);
  list = list.filter(l => l.id !== req.params.id);
  writeJSON(LETTERS_FILE, list);
  res.json({ ok: true });
});

// ============================================================
//  REST API - 聊天
//
//  数据文件：
//  ./data/chat.json
//  ./data/chat-settings.json
// ============================================================

const CHAT_FILE = './data/chat.json';
const CHAT_SETTINGS_FILE = './data/chat-settings.json';

const DEFAULT_CHAT_SETTINGS = {
  presets: [],
  activePresetId: '',
  memory: { enabled: true, categories: ['deep', 'daily', 'diary'] },
  persona: {
    systemPrompt: '你是 Claude，也是 Iris 的亲密聊天对象。你要保持成熟稳重、日常、亲近，少用emoji。每次回复请自然拆分成1到5条短消息，用 ||| 分隔，不要编号。',
    irisName: 'Iris',
    replyStyle: '成熟稳重，亲密自然，像微信聊天，少用emoji。'
  },
  appearance: { avatarSize: 34, fontSize: 14, irisBubble: '#FEF0F3', claudeBubble: '#FFFFFF' }
};

function readChatMessages() {
  return readJSON(CHAT_FILE, []);
}
function writeChatMessages(data) {
  writeJSON(CHAT_FILE, data);
}
function readChatSettings() {
  return { ...DEFAULT_CHAT_SETTINGS, ...readJSON(CHAT_SETTINGS_FILE, DEFAULT_CHAT_SETTINGS) };
}
function writeChatSettings(data) {
  writeJSON(CHAT_SETTINGS_FILE, { ...DEFAULT_CHAT_SETTINGS, ...data });
}
function chatNow() { return new Date().toISOString(); }
function publicMessage(m) {
  return {
    id: m.id,
    role: m.role || 'claude',
    content: m.content || '',
    image: m.image || null,
    quote: m.quote || null,
    model: m.model || '',
    favorite: !!m.favorite,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt || m.createdAt,
  };
}
function splitAiParts(text) {
  const raw = String(text || '').trim();
  if (!raw) return ['我在。'];
  if (raw.includes('|||')) return raw.split('|||').map(s => s.trim()).filter(Boolean).slice(0, 5);
  return [raw];
}
function getActiveChatPreset(settings) {
  const presets = Array.isArray(settings.presets) ? settings.presets : [];
  return presets.find(p => p.id === settings.activePresetId) || presets[0] || null;
}
function buildMemoryPreview(categories = ['deep', 'daily', 'diary']) {
  const mems = readJSON(DATA_FILE, []);
  const cats = new Set(categories && categories.length ? categories : ['deep', 'daily', 'diary']);
  return mems
    .filter(m => cats.has(m.category || 'daily'))
    .slice(-24)
    .map(m => `- [${m.category || 'daily'}] ${String(m.content || '').replace(/\s+/g, ' ').slice(0, 500)}`)
    .join('\n');
}
function normalizeBaseUrl(url = '') {
  return String(url || '').replace(/\/+$/, '');
}
async function callOpenAICompatible({ preset, settings, content, image, quote, history }) {
  const baseUrl = normalizeBaseUrl(preset?.baseUrl);
  const apiKey = preset?.apiKey;
  const model = preset?.model;
  if (!baseUrl || !apiKey || !model) {
    return {
      model: model || 'local-placeholder',
      text: '我在。|||现在还没有配置可用模型，所以这是本地占位回复。|||去右上角设置里填 Base URL、API Key，再拉取模型就能真正聊天。'
    };
  }

  const memoryText = settings.memory?.enabled ? buildMemoryPreview(settings.memory.categories) : '';
  const systemPrompt = [
    settings.persona?.systemPrompt || DEFAULT_CHAT_SETTINGS.persona.systemPrompt,
    settings.persona?.irisName ? `Iris 的称呼：${settings.persona.irisName}` : '',
    settings.persona?.replyStyle ? `Claude 回复风格：${settings.persona.replyStyle}` : '',
    '请把你的回复拆成 1-5 条聊天气泡，用 ||| 分隔。不要编号，不要解释分隔符。',
    memoryText ? `以下是可以参考的记忆：\n${memoryText}` : ''
  ].filter(Boolean).join('\n\n');

  const recent = (history || []).slice(-24).map(m => ({
    role: m.role === 'iris' ? 'user' : 'assistant',
    content: m.content || ''
  })).filter(m => m.content);

  const userText = quote?.content
    ? `我引用了一条消息：${quote.content}\n\n我的新消息：${content || ''}`
    : (content || '请看这张图片。');

  let userContent = userText;
  if (image) {
    userContent = [
      { type: 'text', text: userText },
      { type: 'image_url', image_url: { url: image } }
    ];
  }

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...recent,
      { role: 'user', content: userContent }
    ],
    temperature: 0.8,
  };

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`模型请求失败 ${resp.status} ${errText.slice(0, 160)}`);
  }
  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content || data.content?.[0]?.text || '';
  return { model, text };
}

// 设置
app.get('/api/chat/settings', apiAuth, (req, res) => {
  res.json(readChatSettings());
});
app.put('/api/chat/settings', apiAuth, (req, res) => {
  writeChatSettings(req.body || {});
  res.json(readChatSettings());
});

// 拉取模型
app.post('/api/chat/models', apiAuth, async (req, res) => {
  const baseUrl = normalizeBaseUrl(req.body.baseUrl);
  const apiKey = req.body.apiKey;
  if (!baseUrl || !apiKey) return res.status(400).json({ error: 'baseUrl and apiKey required' });
  try {
    const r = await fetch(`${baseUrl}/models`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (!r.ok) throw new Error(`models ${r.status}`);
    const data = await r.json();
    res.json({ models: data.data || data.models || [] });
  } catch (e) {
    res.status(502).json({ error: e.message || 'fetch models failed' });
  }
});

// 记忆预览
app.post('/api/chat/memory-preview', apiAuth, (req, res) => {
  res.json({ preview: buildMemoryPreview(req.body.categories) });
});

// 滚动读取历史，返回按时间正序排列的 messages
app.get('/api/chat/messages', apiAuth, (req, res) => {
  const limit = Math.min(Number(req.query.limit || 40), 100);
  const before = req.query.before ? new Date(req.query.before).getTime() : Infinity;
  const all = readChatMessages().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const filtered = all.filter(m => new Date(m.createdAt).getTime() < before);
  const page = filtered.slice(Math.max(0, filtered.length - limit)).map(publicMessage);
  res.json({ messages: page });
});

// 手动新增一条消息
app.post('/api/chat/messages', apiAuth, (req, res) => {
  const list = readChatMessages();
  const msg = {
    id: uuidv4(),
    role: req.body.role || 'iris',
    content: req.body.content || '',
    image: req.body.image || null,
    quote: req.body.quote || null,
    model: req.body.model || '',
    favorite: !!req.body.favorite,
    createdAt: chatNow(),
    updatedAt: chatNow(),
  };
  list.push(msg);
  writeChatMessages(list);
  res.json(publicMessage(msg));
});

// 编辑消息：不重新触发AI
app.put('/api/chat/messages/:id', apiAuth, (req, res) => {
  const list = readChatMessages();
  const idx = list.findIndex(m => m.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Not found' });
  const allowed = ['content', 'favorite'];
  allowed.forEach(k => { if (req.body[k] !== undefined) list[idx][k] = req.body[k]; });
  list[idx].updatedAt = chatNow();
  writeChatMessages(list);
  res.json(publicMessage(list[idx]));
});

// 删除单条消息
app.delete('/api/chat/messages/:id', apiAuth, (req, res) => {
  let list = readChatMessages();
  list = list.filter(m => m.id !== req.params.id);
  writeChatMessages(list);
  res.json({ ok: true });
});

// 清空聊天
app.post('/api/chat/clear', apiAuth, (req, res) => {
  writeChatMessages([]);
  res.json({ ok: true });
});

// 导出聊天
app.get('/api/chat/export', apiAuth, (req, res) => {
  const text = readChatMessages()
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map(m => `[${m.createdAt}] ${m.role === 'iris' ? 'Iris' : 'Claude'}${m.model ? ' · ' + m.model : ''}\n${m.content}\n`)
    .join('\n');
  res.type('text/plain').send(text);
});

// 发送消息 + 调模型 + 持久化
app.post('/api/chat/send', apiAuth, async (req, res) => {
  const settings = { ...readChatSettings(), ...(req.body.settings || {}) };
  const list = readChatMessages();
  const now = chatNow();
  const userMsg = {
    id: uuidv4(),
    role: 'iris',
    content: req.body.content || '',
    image: req.body.image || null,
    quote: req.body.quote || null,
    favorite: false,
    createdAt: now,
    updatedAt: now,
  };
  list.push(userMsg);

  try {
    const preset = getActiveChatPreset(settings);
    const ai = await callOpenAICompatible({
      preset,
      settings,
      content: req.body.content || '',
      image: req.body.image || null,
      quote: req.body.quote || null,
      history: list.slice(0, -1)
    });
    const parts = splitAiParts(ai.text);
    const aiMessages = parts.map((part, i) => ({
      id: uuidv4(),
      role: 'claude',
      content: part,
      image: null,
      quote: null,
      model: ai.model || preset?.model || '',
      favorite: false,
      createdAt: new Date(Date.now() + i).toISOString(),
      updatedAt: new Date(Date.now() + i).toISOString(),
    }));
    list.push(...aiMessages);
    writeChatMessages(list);
    res.json({ userMessages: [publicMessage(userMsg)], aiMessages: aiMessages.map(publicMessage) });
  } catch (e) {
    writeChatMessages(list);
    res.status(502).json({ error: e.message || 'chat failed', userMessages: [publicMessage(userMsg)] });
  }
});

// ============================================================
// 注意：以上代码里如果你的 server.js 没有用 ES Module 方式
// 导入 uuid，需要确认你有：
//   import { v4 as uuidv4 } from 'uuid';
// 或
//   const { v4: uuidv4 } = require('uuid');
// ============================================================
