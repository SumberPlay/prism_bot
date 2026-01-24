const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');
const axios = require('axios');

// === НАСТРОЙКИ ===
const BOT_TOKEN = '7809111631:AAGO30xOzwdfZpuL_5ee5GhClmy_94w3UEI';
const ADMIN_CHAT_ID = '5681992508';
const SERVER_URL = 'https://prism-bot.onrender.com/'; 

const app = express();
const bot = new Telegraf(BOT_TOKEN);

let currentSystemState = "NORMAL";
let customLabel = "ШТАТНЫЙ РЕЖИМ";

// === MIDDLEWARE ===
app.use(cors()); // КРИТИЧЕСКИ ВАЖНО для связи между разными хостингами
app.use(express.json());

// === МАРШРУТЫ (Только API) ===

// Вместо ошибки - простое сообщение
app.get('/', (req, res) => {
    res.status(200).send('P.R.I.S.M. API Server is RUNNING');
});

// Сайт с другого хостинга будет запрашивать это:
app.get('/status', (req, res) => {
    res.json({
        state: currentSystemState,
        label: customLabel,
        color: currentSystemState === "RED" ? "#ff3300" : "#00ffcc"
    });
});

// Прием рапортов
app.post('/send-report', (req, res) => {
    const { user, subject, text, timestamp } = req.body;
    const report = `📝 **НОВЫЙ РАПОРТ**\n👤 От: ${user}\n📋 Тема: ${subject}\n⏰ Время: ${timestamp}\n\n${text}`;
    
    bot.telegram.sendMessage(ADMIN_CHAT_ID, report, { parse_mode: 'Markdown' })
        .then(() => res.json({ success: true }))
        .catch(() => res.status(500).json({ success: false }));
});

// === КНОПКИ БОТА ===
const mainMenu = Markup.keyboard([
    ['🔴 АКТИВИРОВАТЬ RED CODE', '🟢 ВЕРНУТЬ STABLE'],
    ['📝 ИЗМЕНИТЬ СТАТУС', '📊 ТЕКУЩИЙ СТАТУС']
]).resize();

bot.start((ctx) => ctx.reply('🛡️ Управление P.R.I.S.M. активно', mainMenu));

bot.hears('🔴 АКТИВИРОВАТЬ RED CODE', (ctx) => {
    currentSystemState = "RED";
    customLabel = "КРИТИЧЕСКАЯ УГРОЗА";
    ctx.reply('🚨 RED CODE активирован!');
});

bot.hears('🟢 ВЕРНУТЬ STABLE', (ctx) => {
    currentSystemState = "NORMAL";
    customLabel = "ШТАТНЫЙ РЕЖИМ";
    ctx.reply('✅ Система стабилизирована.');
});

bot.command('setstatus', (ctx) => {
    const text = ctx.message.text.split(' ').slice(1).join(' ');
    if (!text) return ctx.reply('Используй: /setstatus ТЕКСТ');
    customLabel = text.toUpperCase();
    ctx.reply(`✅ Статус: ${customLabel}`);
});

bot.hears('📊 ТЕКУЩИЙ СТАТУС', (ctx) => {
    ctx.reply(`Состояние: ${currentSystemState}\nТекст: ${customLabel}`);
});

bot.hears('📝 ИЗМЕНИТЬ СТАТУС', (ctx) => {
    ctx.reply('Отправь команду: `/setstatus ТВОЙ ТЕКСТ`', { parse_mode: 'Markdown' });
});

// === АНТИ-СОН ===
setInterval(() => {
    axios.get(SERVER_URL).catch(() => {});
}, 10 * 60 * 1000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API Server started on port ${PORT}`);
    bot.launch();
});

