const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');
const axios = require('axios');

// === КОНФИГУРАЦИЯ ===
const BOT_TOKEN = '7809111631:AAGO30xOzwdfZpuL_5ee5GhClmy_94w3UEI';
const ADMIN_CHAT_ID = '5681992508'; 
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; 
const GITHUB_REPO = process.env.GITHUB_REPO;   
const FILE_PATH = 'data/archive.json';

const app = express();
const bot = new Telegraf(BOT_TOKEN);

app.use(cors());
app.use(express.json());

// === СОСТОЯНИЯ И БАЗЫ ===
const userStates = new Map();
const chatHistory = new Map();
let systemStatus = { state: "NORMAL", label: "ШТАТНЫЙ РЕЖИМ", color: "#00ffcc", reason: "" };

let staffDB = {
    "SUMBR": { pass: "8aaa688aadaf78796f5f620a4897eeb3", level: 5, name: "Самбер", role: "council" },
    "MRYZE": { pass: "b0eee0a274f64e6f5792b85c93321159", level: 5, name: "Юз", role: "council" },
    "RAY": { pass: "c20b11e4ce0f2d30e2d4d4f4e4089192", level: 5, name: "Рей", role: "council" },
    "MRS": { pass: "ff88883a61ea14ec248d3739c52aee16", level: 4, name: "Морис", role: "scientific" },
    "M4SK": { pass: "5e03fcd2d70a976a6b026374da5da3f9", level: 3, name: "МэнсиКейн", role: "scientific" },
    "KRMP": { pass: "1bf502b835ee007957e558cbb1959ecb", level: 2, name: "Кримпи", role: "military" }
};

let playerDB = {
    "M4SK": { level: 3, name: "МэнсиКейн", mc_name: "M4skine_", dept: "НАУЧНЫЙ ОТДЕЛ", bio: "Исследователь аномалий." },
    "KRMP": { level: 2, name: "Кримпи", mc_name: "Krimpi", dept: "ВГР", bio: "Глава ВГР ES." },
    "SUMBR": { level: 5, name: "Самбер", mc_name: "SumberTheCreator", dept: "ВЫСШИЙ СОВЕТ", bio: "Основатель P.R.I.S.M." }
};

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
const trackMsg = (ctx, msg) => {
    if (msg?.message_id) {
        if (!chatHistory.has(ctx.chat.id)) chatHistory.set(ctx.chat.id, []);
        chatHistory.get(ctx.chat.id).push(msg.message_id);
    }
};

async function addNoteToGithub(note) {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE_PATH}?t=${Date.now()}`;
    const headers = { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' };
    try {
        const res = await axios.get(url, { headers });
        const currentSha = res.data.sha; 
        const archiveArray = JSON.parse(Buffer.from(res.data.content, 'base64').toString() || "[]");
        archiveArray.push(note);
        await axios.put(url, {
            message: `Update: ${note.title}`,
            content: Buffer.from(JSON.stringify(archiveArray, null, 4)).toString('base64'),
            sha: currentSha
        }, { headers });
        return true;
    } catch (e) { return false; }
}

// === API ДЛЯ САЙТА ===
app.post('/login', (req, res) => {
    const { id, pass } = req.body;
    const u = staffDB[id];
    if (u && u.pass === pass) res.json({ success: true, level: u.level, name: u.name, role: u.role });
    else res.status(401).json({ success: false });
});

app.get('/status', (req, res) => res.json(systemStatus));

app.post('/send-report', async (req, res) => {
    const { user, text, timestamp } = req.body;
    const note = { id: `W${Date.now()}`, title: `РАПОРТ: ${user}`, level: 1, content: text, date: timestamp || new Date().toLocaleString() };
    if (await addNoteToGithub(note)) {
        bot.telegram.sendMessage(ADMIN_CHAT_ID, `📝 **ВЕБ-РАПОРТ**\nОт: ${user}\n\n${text}`, { parse_mode: 'Markdown' });
        res.json({ success: true });
    } else res.status(500).json({ success: false });
});

app.post('/auth-log', (req, res) => {
    bot.telegram.sendMessage(ADMIN_CHAT_ID, `🔐 **ВХОД**\n${req.body.name} (${req.body.id})\nL${req.body.level}`);
    res.json({ success: true });
});

// === ЛОГИКА БОТА ===
const mainMenu = Markup.keyboard([['🔴 RED CODE', '🟢 STABLE'], ['📝 НОВАЯ ЗАПИСЬ', '📂 АРХИВ'], ['👥 ДОСЬЕ', '👔 СОТРУДНИКИ'], ['📊 СТАТУС', '🧹 ОЧИСТКА']]).resize();

bot.start((ctx) => ctx.reply('🛡️ Терминал P.R.I.S.M. активен.', mainMenu));

bot.hears('👥 ДОСЬЕ', async (ctx) => {
    let list = "📂 **РЕЕСТР СУБЪЕКТОВ:**\n━━━━━━━━━━━━━━\n";
    Object.keys(playerDB).forEach(id => { const p = playerDB[id]; list += `🔹 \`${id}\` — **${p.name}**\n   _Отдел:_ ${p.dept}\n`; });
    trackMsg(ctx, await ctx.reply(list, { parse_mode: 'Markdown' }));
});

bot.hears('👔 СОТРУДНИКИ', async (ctx) => {
    if (ctx.chat.id.toString() !== ADMIN_CHAT_ID) return;
    let list = "🛡️ **РЕЕСТР ДОСТУПА:**\n━━━━━━━━━━━━━━\n";
    Object.keys(staffDB).forEach(id => { const s = staffDB[id]; list += `🔸 \`${id}\` — **${s.name}** (L${s.level})\n   _Pass:_ \`${s.pass}\`\n`; });
    trackMsg(ctx, await ctx.reply(list, { parse_mode: 'Markdown' }));
});

bot.hears('📊 СТАТУС', async (ctx) => {
    trackMsg(ctx, await ctx.reply(`📊 **СТАТУС:**\n${systemStatus.label}\n${systemStatus.reason}`, { parse_mode: 'Markdown' }));
});

bot.hears('🟢 STABLE', (ctx) => {
    if (ctx.chat.id.toString() !== ADMIN_CHAT_ID) return;
    systemStatus = { state: "NORMAL", label: "ШТАТНЫЙ РЕЖИМ", color: "#00ffcc", reason: "" };
    ctx.reply('✅ Стабилизировано.', mainMenu);
});

bot.hears('🔴 RED CODE', async (ctx) => {
    if (ctx.chat.id.toString() !== ADMIN_CHAT_ID) return;
    userStates.set(ctx.from.id, { step: 'WAIT_REASON' });
    ctx.reply('🚨 ПРИЧИНА ТРЕВОГИ:', Markup.removeKeyboard());
});

bot.hears('📝 НОВАЯ ЗАПИСЬ', async (ctx) => {
    if (ctx.chat.id.toString() !== ADMIN_CHAT_ID) return;
    userStates.set(ctx.from.id, { step: 'WAIT_TITLE' });
    ctx.reply('📄 ЗАГОЛОВОК:', Markup.removeKeyboard());
});

bot.on('text', async (ctx, next) => {
    const state = userStates.get(ctx.from.id);
    if (!state) return next();
    if (state.step === 'WAIT_REASON') {
        systemStatus = { state: "RED", label: "🚨 ТРЕВОГА", color: "#ff4444", reason: ctx.message.text };
        userStates.delete(ctx.from.id);
        ctx.reply(`⚠️ RED CODE АКТИВИРОВАН`, mainMenu);
    } else if (state.step === 'WAIT_TITLE') {
        userStates.set(ctx.from.id, { step: 'WAIT_LEVEL', title: ctx.message.text });
        ctx.reply('🔑 УРОВЕНЬ (1-5):');
    } else if (state.step === 'WAIT_LEVEL') {
        userStates.set(ctx.from.id, { ...state, step: 'WAIT_TEXT', level: ctx.message.text });
        ctx.reply('✍️ ТЕКСТ:');
    } else if (state.step === 'WAIT_TEXT') {
        const note = { id: `L${Date.now()}`, title: state.title, level: parseInt(state.level), content: ctx.message.text, date: new Date().toLocaleDateString('ru-RU') };
        ctx.reply(await addNoteToGithub(note) ? '✅ СОХРАНЕНО' : '❌ ОШИБКА', mainMenu);
        userStates.delete(ctx.from.id);
    }
});

bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
app.listen(process.env.PORT || 10000, () => console.log("SERVER_OK"));
