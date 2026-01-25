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
    if (msg && msg.message_id) {
        if (!chatHistory.has(ctx.chat.id)) chatHistory.set(ctx.chat.id, []);
        chatHistory.get(ctx.chat.id).push(msg.message_id);
    }
};

async function addNoteToGithub(note) {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE_PATH}`;
    const headers = { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' };
    try {
        const res = await axios.get(url, { headers });
        const content = JSON.parse(Buffer.from(res.data.content, 'base64').toString());
        content.push(note);
        await axios.put(url, {
            message: `Archive Update: ${note.title}`,
            content: Buffer.from(JSON.stringify(content, null, 4)).toString('base64'),
            sha: res.data.sha
        }, { headers });
        return true;
    } catch (e) {
        console.error("GH_SYNC_ERROR:", e.response ? e.response.data : e.message);
        return false;
    }
}

// === API ЭНДПОИНТЫ ===
app.get('/', (req, res) => res.send('SERVER_HEARTBEAT_OK'));
app.post('/login', (req, res) => {
    const { id, pass } = req.body;
    const user = staffDB[id];
    if (user && user.pass === pass) res.json({ success: true, level: user.level, name: user.name, role: user.role });
    else res.status(401).json({ success: false });
});
app.get('/get-staff', (req, res) => res.json(playerDB));
app.get('/status', (req, res) => res.json(systemStatus));

// === ТЕЛЕГРАМ БОТ ===
const mainMenu = Markup.keyboard([
    ['🔴 RED CODE', '🟢 STABLE'],
    ['📝 НОВАЯ ЗАПИСЬ', '📂 АРХИВ'],
    ['👥 ДОСЬЕ', '👔 СОТРУДНИКИ'],
    ['📊 СТАТУС', '🧹 ОЧИСТКА']
]).resize();

bot.start(async (ctx) => {
    const msg = await ctx.reply('🛡️ Терминал P.R.I.S.M. активен.', mainMenu);
    trackMsg(ctx, msg);
});

// --- 👥 ДОСЬЕ ---
bot.hears('👥 ДОСЬЕ', async (ctx) => {
    let list = "📂 **РЕЕСТР СУБЪЕКТОВ:**\n━━━━━━━━━━━━━━\n";
    Object.keys(playerDB).forEach(id => {
        const p = playerDB[id];
        list += `🔹 \`${id}\` — **${p.name}** (L${p.level})\n   _Отдел:_ ${p.dept}\n`;
    });
    const msg = await ctx.reply(list, { parse_mode: 'Markdown' });
    trackMsg(ctx, msg);
});

// --- 👔 СОТРУДНИКИ ---
bot.hears('👔 СОТРУДНИКИ', async (ctx) => {
    if (ctx.chat.id.toString() !== ADMIN_CHAT_ID) return ctx.reply('ДОСТУП ЗАПРЕЩЕН');
    let list = "🛡️ **РЕЕСТР ДОСТУПА:**\n━━━━━━━━━━━━━━\n";
    Object.keys(staffDB).forEach(id => {
        const s = staffDB[id];
        list += `🔸 \`${id}\` — **${s.name}**\n   _Pass:_ \`${s.pass}\` | _Lvl:_ ${s.level}\n`;
    });
    const msg = await ctx.reply(list, { parse_mode: 'Markdown' });
    trackMsg(ctx, msg);
});

// --- 📊 СТАТУС ---
bot.hears('📊 СТАТУС', async (ctx) => {
    let message = `📊 **СТАТУС СИСТЕМЫ:**\n━━━━━━━━━━━━━━\n🔹 Режим: **${systemStatus.label}**\n`;
    if (systemStatus.reason) message += `📝 Детали: _${systemStatus.reason}_`;
    const msg = await ctx.reply(message, { parse_mode: 'Markdown' });
    trackMsg(ctx, msg);
});

// --- 📂 ПРОСМОТР АРХИВА ---
bot.hears('📂 АРХИВ', async (ctx) => {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE_PATH}`;
    const headers = { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' };
    try {
        const res = await axios.get(url, { headers });
        const content = JSON.parse(Buffer.from(res.data.content, 'base64').toString());
        if (content.length === 0) return ctx.reply("Архив пуст.");

        const lastNotes = content.slice(-5).reverse();
        for (const note of lastNotes) {
            const msg = await ctx.reply(
                `📄 **${note.title}** (L${note.level})\n🗓 _${note.date}_\n\n${note.content}`,
                Markup.inlineKeyboard([Markup.button.callback('🗑 Удалить', `del_${note.id}`)])
            );
            trackMsg(ctx, msg);
        }
    } catch (e) { ctx.reply("❌ Ошибка чтения GitHub"); }
});

// --- ОБРАБОТЧИК УДАЛЕНИЯ (Inline Button) ---
bot.action(/^del_(.+)$/, async (ctx) => {
    const noteId = ctx.match[1];
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE_PATH}`;
    const headers = { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' };
    try {
        const res = await axios.get(url, { headers });
        let content = JSON.parse(Buffer.from(res.data.content, 'base64').toString());
        const newContent = content.filter(n => n.id !== noteId);
        await axios.put(url, {
            message: `Archive: Delete ${noteId}`,
            content: Buffer.from(JSON.stringify(newContent, null, 4)).toString('base64'),
            sha: res.data.sha
        }, { headers });
        await ctx.answerCbQuery("Запись удалена!");
        await ctx.editMessageText("🗑 Запись удалена из облака.");
    } catch (e) { await ctx.answerCbQuery("Ошибка API"); }
});

// --- 🧹 ОЧИСТКА ---
bot.hears('🧹 ОЧИСТКА', async (ctx) => {
    const ids = chatHistory.get(ctx.chat.id) || [];
    for (const id of ids) { try { await ctx.deleteMessage(id); } catch(e) {} }
    try { await ctx.deleteMessage(ctx.message.message_id); } catch(e) {}
    chatHistory.set(ctx.chat.id, []);
    const msg = await ctx.reply('🧹 Терминал очищен.', mainMenu);
    trackMsg(ctx, msg);
});

bot.hears('📝 НОВАЯ ЗАПИСЬ', async (ctx) => {
    if (ctx.chat.id.toString() !== ADMIN_CHAT_ID) return ctx.reply('ДОСТУП ЗАПРЕЩЕН');
    userStates.set(ctx.from.id, { step: 'WAIT_TITLE' });
    const msg = await ctx.reply('📄 Введите ЗАГОЛОВОК:', Markup.removeKeyboard());
    trackMsg(ctx, msg);
});

bot.hears('🔴 RED CODE', async (ctx) => {
    userStates.set(ctx.from.id, { step: 'WAIT_REASON' });
    const msg = await ctx.reply('🚨 Укажите причину:', Markup.removeKeyboard());
    trackMsg(ctx, msg);
});

bot.hears('🟢 STABLE', async (ctx) => {
    systemStatus = { state: "NORMAL", label: "ШТАТНЫЙ РЕЖИМ", color: "#00ffcc", reason: "" };
    const msg = await ctx.reply('✅ Система стабилизирована.', mainMenu);
    trackMsg(ctx, msg);
});

// --- ГЛОБАЛЬНЫЙ ОБРАБОТЧИК ТЕКСТА ---
bot.on('text', async (ctx, next) => {
    const state = userStates.get(ctx.from.id);
    if (!state) return next();
    const txt = ctx.message.text;

    if (state.step === 'WAIT_REASON') {
        systemStatus = { state: "RED", label: "🚨 КРИТИЧЕСКОЕ СОСТОЯНИЕ", color: "#ff4444", reason: txt };
        userStates.delete(ctx.from.id);
        const msg = await ctx.reply(`⚠️ RED CODE АКТИВИРОВАН`, mainMenu);
        trackMsg(ctx, msg);
    } 
    else if (state.step === 'WAIT_TITLE') {
        userStates.set(ctx.from.id, { step: 'WAIT_LEVEL', title: txt });
        const msg = await ctx.reply('🔑 Введите уровень допуска (1-5):');
        trackMsg(ctx, msg);
    }
    else if (state.step === 'WAIT_LEVEL') {
        const lvl = parseInt(txt);
        if (isNaN(lvl) || lvl < 1 || lvl > 5) return ctx.reply('Цифру от 1 до 5!');
        userStates.set(ctx.from.id, { ...state, step: 'WAIT_TEXT', level: lvl });
        const msg = await ctx.reply('✍️ Введите содержание:');
        trackMsg(ctx, msg);
    }
    else if (state.step === 'WAIT_TEXT') {
        const note = { id: `L${Date.now()}`, title: state.title, level: state.level, content: txt, date: new Date().toLocaleDateString('ru-RU') };
        const msgStatus = await ctx.reply('⏳ Синхронизация...');
        const success = await addNoteToGithub(note);
        userStates.delete(ctx.from.id);
        await ctx.deleteMessage(msgStatus.message_id);
        const msgRes = await ctx.reply(success ? '✅ ЗАПИСЬ СОХРАНЕНА' : '❌ ОШИБКА ГИТХАБА', mainMenu);
        trackMsg(ctx, msgRes);
    }
});

bot.launch();
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`PRISM_SERVER_READY_PORT_${PORT}`));
