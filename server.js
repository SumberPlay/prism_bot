const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');
const axios = require('axios');

// === НАСТРОЙКИ ===
// Исправлено: токен и ID теперь передаются как строки напрямую
const BOT_TOKEN = '7809111631:AAGO30xOzwdfZpuL_5ee5GhClmy_94w3UEI';
const ADMIN_CHAT_ID = '5681992508';
const SERVER_URL = 'https://prism-bot.onrender.com'; 

const app = express();
const bot = new Telegraf(BOT_TOKEN);

// Глобальное состояние системы
let currentSystemState = "NORMAL";
let customLabel = "ШТАТНЫЙ РЕЖИМ";
let incidentReason = ""; 
let awaitingReason = false; 

// === MIDDLEWARE ===
app.use(cors());
app.use(express.json());

// === API ДЛЯ САЙТА ===

app.get('/', (req, res) => {
    res.send('P.R.I.S.M. Control Unit: ONLINE');
});

app.get('/status', (req, res) => {
    res.json({
        state: currentSystemState,
        label: customLabel,
        color: currentSystemState === "RED" ? "#ff4444" : "#00ffcc",
        reason: incidentReason
    });
});

app.post('/send-report', (req, res) => {
    const { user, subject, text, timestamp } = req.body;
    const report = `📝 **НОВЫЙ РАПОРТ P.R.I.S.M.**\n👤 От: ${user}\n📋 Тема: ${subject}\n⏰ Время: ${timestamp}\n\nСообщение:\n${text}`;
    
    bot.telegram.sendMessage(ADMIN_CHAT_ID, report, { parse_mode: 'Markdown' })
        .then(() => res.json({ success: true }))
        .catch(err => {
            console.error('Ошибка отправки в TG:', err);
            res.status(500).json({ success: false });
        });
});

// === ЛОГИКА БОТА ===

const mainMenu = Markup.keyboard([
    ['🔴 АКТИВИРОВАТЬ RED CODE', '🟢 ВЕРНУТЬ STABLE'],
    ['📝 ИЗМЕНИТЬ СТАТУС', '📊 ТЕКУЩИЙ СТАТУС']
]).resize();

bot.start((ctx) => {
    ctx.reply('🛡️ Терминал P.R.I.S.M. активен. Ожидаю команд.', mainMenu);
});

bot.hears('🔴 АКТИВИРОВАТЬ RED CODE', (ctx) => {
    awaitingReason = true;
    ctx.reply('🚨 РЕЖИМ ТРЕВОГИ ИНИЦИИРОВАН.\nВведите причину угрозы для терминалов сотрудников:');
});

bot.hears('🟢 ВЕРНУТЬ STABLE', (ctx) => {
    currentSystemState = "NORMAL";
    customLabel = "ШТАТНЫЙ РЕЖИМ";
    incidentReason = ""; 
    awaitingReason = false;
    ctx.reply('✅ Система стабилизирована. Причина сброшена.', mainMenu);
});

bot.hears('📊 ТЕКУЩИЙ СТАТУС', (ctx) => {
    ctx.reply(`📊 ТЕКУЩИЙ СТАТУС:\n\nСостояние: ${currentSystemState}\nТекст: ${customLabel}\nПричина: ${incidentReason || "Не указана"}`);
});

bot.hears('📝 ИЗМЕНИТЬ СТАТУС', (ctx) => {
    ctx.reply('Чтобы изменить текст статуса в мирное время, введите:\n/setstatus ВАШ ТЕКСТ');
});

bot.command('setstatus', (ctx) => {
    const text = ctx.message.text.split(' ').slice(1).join(' ');
    if (!text) return ctx.reply('Используй: /setstatus ТЕКСТ');
    customLabel = text.toUpperCase();
    ctx.reply(`✅ Статус обновлен на: ${customLabel}`);
});

bot.on('text', (ctx) => {
    if (awaitingReason) {
        currentSystemState = "RED";
        customLabel = "КРИТИЧЕСКАЯ УГРОЗА";
        incidentReason = ctx.message.text; 
        awaitingReason = false;
        ctx.reply(`🚨 СТАТУС RED CODE УСТАНОВЛЕН!\nПричина: ${incidentReason}\n\nСайт и терминалы сотрудников обновлены.`, mainMenu);
    }
});

// === АНТИ-СОН ===
setInterval(() => {
    axios.get(SERVER_URL).catch(() => console.log('Keep-alive ping sent.'));
}, 10 * 60 * 1000); 

// === ЗАПУСК ===
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`P.R.I.S.M. Server started on port ${PORT}`);
    
    bot.launch()
        .then(() => console.log('Telegram Bot connected!'))
        .catch((err) => console.error('Bot launch error:', err));
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
