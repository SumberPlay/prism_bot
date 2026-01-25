const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');
const axios = require('axios');
const CryptoJS = require('crypto-js');

// === КОНФИГУРАЦИЯ (Берется из Environment Variables на Render) ===
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
    if (!chatHistory.has(ctx.chat.id)) chatHistory.set(ctx.chat.id, []);
    chatHistory.get(ctx.chat.id).push(msg.message_id);
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
        console.error('--- GITHUB API ERROR ---');
        if (e.response) {
            // Ошибка пришла от самого GitHub (например, 404 или 401)
            console.error('Status:', e.response.status);
            console.error('Data:', e.response.data);
        } else {
            // Ошибка сети или кода
            console.error('Message:', e.message);
        }
        return false; 
    }
}

// === API ===
app.get('/', (req, res) => res.send('SERVER_HEARTBEAT_OK'));

app.post('/login', (req, res) => {
    const { id, pass } = req.body;
    const user = staffDB[id];
    if (user && user.pass === pass) res.json({ success: true, level: user.level, name: user.name, role: user.role });
    else res.status(401).json({ success: false });
});

app.get('/get-staff', (req, res) => res.json(playerDB));

app.post('/auth-log', (req, res) => {
    const { id, name, level } = req.body;
    bot.telegram.sendMessage(ADMIN_CHAT_ID, `👤 **ВХОД В СИСТЕМУ**\nID: \`${id}\`\nИмя: **${name}**\nДопуск: **L${level}**`, { parse_mode: 'Markdown' });
    res.json({ success: true });
});

app.get('/status', (req, res) => res.json(systemStatus));

// === ТЕЛЕГРАМ БОТ ===
const mainMenu = Markup.keyboard([
    ['🔴 RED CODE', '🟢 STABLE'],
    ['📝 НОВАЯ ЗАПИСЬ', '📊 ТЕКУЩИЙ СТАТУС'],
    ['👥 ДОСЬЕ', '👔 СОТРУДНИКИ'],
    ['🧹 ОЧИСТКА']
]).resize();

bot.start(async (ctx) => {
    const msg = await ctx.reply('🛡️ Терминал P.R.I.S.M. активен.', mainMenu);
    trackMsg(ctx, msg);
});

bot.hears('📊 ТЕКУЩИЙ СТАТУС', async (ctx) => {
    let message = `📊 **СТАТУС СИСТЕМЫ:**\n\n🔹 Режим: **${systemStatus.label}**\n`;
    if (systemStatus.reason) message += `📝 Детали: _${systemStatus.reason}_`;
    const msg = await ctx.reply(message, { parse_mode: 'Markdown' });
    trackMsg(ctx, msg);
});

bot.hears('📝 НОВАЯ ЗАПИСЬ', async (ctx) => {
    if (ctx.chat.id.toString() !== ADMIN_CHAT_ID) return ctx.reply('ДОСТУП ЗАПРЕЩЕН');
    userStates.set(ctx.from.id, { step: 'WAITING_NOTE_TITLE' });
    const msg = await ctx.reply('📄 Введите ЗАГОЛОВОК записки:', Markup.removeKeyboard());
    trackMsg(ctx, msg);
});

bot.hears('🧹 ОЧИСТКА', async (ctx) => {
    const ids = chatHistory.get(ctx.chat.id) || [];
    for (const id of ids) { try { await ctx.deleteMessage(id); } catch(e) {} }
    chatHistory.set(ctx.chat.id, []);
    const msg = await ctx.reply('🧹 Очищено.', mainMenu);
    trackMsg(ctx, msg);
});

bot.hears('🔴 RED CODE', async (ctx) => {
    userStates.set(ctx.from.id, { step: 'WAITING_FOR_REASON' });
    await ctx.reply('🚨 Укажите причину критического состояния:', Markup.removeKeyboard());
});

bot.hears('🟢 STABLE', async (ctx) => {
    systemStatus = { state: "NORMAL", label: "ШТАТНЫЙ РЕЖИМ", color: "#00ffcc", reason: "" };
    await ctx.reply('✅ Система переведена в штатный режим.', mainMenu);
});

// Глобальный обработчик текста (для диалогов с ботом)
bot.on('text', async (ctx, next) => {
    const state = userStates.get(ctx.from.id);
    if (!state) return next();

    const userId = ctx.from.id;
    const txt = ctx.message.text;

    if (state.step === 'WAITING_FOR_REASON') {
        systemStatus = { state: "RED", label: "🚨 КРИТИЧЕСКОЕ СОСТОЯНИЕ", color: "#ff4444", reason: txt };
        userStates.delete(userId);
        await ctx.reply(`⚠️ РЕЖИМ RED CODE АКТИВИРОВАН`, mainMenu);
    } 
    else if (state.step === 'WAITING_NOTE_TITLE') {
        userStates.set(userId, { step: 'WAITING_NOTE_LEVEL', title: txt });
        await ctx.reply('🔑 Укажите уровень допуска (1-5):');
    }
    else if (state.step === 'WAITING_NOTE_LEVEL') {
        const lvl = parseInt(txt);
        if (isNaN(lvl) || lvl < 1 || lvl > 5) return ctx.reply('Ошибка! Введите цифру от 1 до 5.');
        userStates.set(userId, { ...state, step: 'WAITING_NOTE_TEXT', level: lvl });
        await ctx.reply('✍️ Введите основной текст записки:');
    }
    else if (state.step === 'WAITING_NOTE_TEXT') {
        const note = {
            id: `LOG_${Date.now()}`,
            title: state.title,
            level: state.level,
            content: txt,
            date: new Date().toLocaleDateString('ru-RU')
        };
        await ctx.reply('⏳ Сохранение в облачный архив GitHub...');
        const success = await addNoteToGithub(note);
        userStates.delete(userId);
        if (success) await ctx.reply('✅ ЗАПИСЬ ДОБАВЛЕНА', mainMenu);
        else await ctx.reply('❌ ОШИБКА СИНХРОНИЗАЦИИ', mainMenu);
    }
});

bot.launch();
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`PRISM_SERVER_ONLINE: ${PORT}`));

