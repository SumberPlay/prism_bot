const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// --- НАСТРОЙКИ (ЗАПОЛНИ ИХ!) ---
const BOT_TOKEN = 'ТВОЙ_ТОКЕН_ИЗ_BOTFATHER'; 
const RENDER_URL = 'https://твой-адрес-на-render.onrender.com'; 
const SECRET_PATH = `/webhook/${BOT_TOKEN}`;

const bot = new Telegraf(BOT_TOKEN);

// --- ПАМЯТЬ СИСТЕМЫ ---
let adminChatId = null; 
let systemState = { state: "STABLE", label: "LEVEL: NORMAL", color: "#00ffcc" };
let reports = [];
let messageHistory = []; 

// Запоминаем ID сообщений для удаления
const trackMsg = (msg) => { if (msg && msg.message_id) messageHistory.push(msg.message_id); };

// --- ЛОГИКА БОТА ---
const mainMenu = Markup.keyboard([
    ['🟢 STABLE', '🔴 RED'],
    ['📝 Последние рапорты', '⚙️ Кастомный статус'],
    ['🧹 Очистить всё']
]).resize();

bot.start(async (ctx) => {
    adminChatId = ctx.chat.id;
    const m = await ctx.reply('Система P.R.I.S.M. онлайн. Жду приказов, Советник.', mainMenu);
    trackMsg(m);
});

bot.hears('🟢 STABLE', async (ctx) => {
    systemState = { state: "STABLE", label: "LEVEL: NORMAL", color: "#00ffcc" };
    const m = await ctx.reply('✅ Статус: ШТАТНЫЙ');
    trackMsg(m);
});

bot.hears('🔴 RED', async (ctx) => {
    systemState = { state: "RED", label: "CRITICAL ERROR", color: "#ff4444" };
    const m = await ctx.reply('⚠️ ВНИМАНИЕ: АКТИВИРОВАН КРИТИЧЕСКИЙ РЕЖИМ!');
    trackMsg(m);
});

bot.command('custom', async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length < 2) return;
    systemState = { state: "CUSTOM", label: args[0].toUpperCase(), color: args[1] };
    const m = await ctx.reply(`⚙️ Статус изменен на: ${args[0]}`);
    trackMsg(m);
});

bot.hears('📝 Последние рапорты', async (ctx) => {
    let text = reports.length === 0 ? 'Архив пуст.' : 'ПОСЛЕДНИЕ РАПОРТЫ:\n\n' + reports.map((r, i) => `${i+1}. [${r.uid}] ${r.text}`).join('\n\n');
    const m = await ctx.reply(text);
    trackMsg(m);
});

// Команда очистки чата и памяти
const clearAll = async (ctx) => {
    if (ctx.chat.id !== adminChatId) return;
    for (const msgId of messageHistory) {
        await ctx.deleteMessage(msgId).catch(() => {});
    }
    messageHistory = [];
    reports = [];
    const m = await ctx.reply('🧹 Система очищена. Все логи и сообщения удалены.', mainMenu);
    trackMsg(m);
};

bot.command('clear', clearAll);
bot.hears('🧹 Очистить всё', clearAll);

// --- API ДЛЯ САЙТА ---
app.get('/status', (req, res) => res.json(systemState));

app.post('/report', async (req, res) => {
    const { uid, text } = req.body;
    const newReport = { uid: uid || "Incognito", text: text, time: new Date().toLocaleTimeString() };
    reports.unshift(newReport);
    if (reports.length > 10) reports.pop();

    if (adminChatId) {
        const m = await bot.telegram.sendMessage(adminChatId, `📥 **РАПОРТ**\n👤 От: ${newReport.uid}\n📝 ${newReport.text}`, { parse_mode: 'Markdown' });
        trackMsg(m);
    }
    res.json({ success: true });
});

// --- ЗАПУСК ---
app.use(bot.webhookCallback(SECRET_PATH));
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    await bot.telegram.setWebhook(`${RENDER_URL}${SECRET_PATH}`);
    console.log('P.R.I.S.M. Core Active');
});
