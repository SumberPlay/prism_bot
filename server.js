const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');
const axios = require('axios');

// === НАСТРОЙКИ ===
const BOT_TOKEN = process.env.7809111631:AAGO30xOzwdfZpuL_5ee5GhClmy_94w3UEI || 'ТВОЙ_ТОКЕН';
const ADMIN_CHAT_ID = process.env.5681992508 || 'ТВОЙ_ID';
const SERVER_URL = 'https://prism-bot.onrender.com'; 

const app = express();
const bot = new Telegraf(BOT_TOKEN);

// Глобальное состояние системы
let currentSystemState = "NORMAL";
let customLabel = "ШТАТНЫЙ РЕЖИМ";
let incidentReason = ""; // Хранилище для причины тревоги
let awaitingReason = false; // Флаг режима ожидания ввода текста

// === MIDDLEWARE ===
app.use(cors());
app.use(express.json());

// === API ДЛЯ САЙТА ===

// Корневой маршрут (заглушка для Render)
app.get('/', (req, res) => {
    res.send('P.R.I.S.M. Control Unit: ONLINE');
});

// Статус для всех страниц (Public & Staff)
app.get('/status', (req, res) => {
    res.json({
        state: currentSystemState,
        label: customLabel,
        color: currentSystemState === "RED" ? "#ff4444" : "#00ffcc",
        reason: incidentReason
    });
});

// Прием рапортов из staff.html
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

// Нажатие на Красную Кнопку
bot.hears('🔴 АКТИВИРОВАТЬ RED CODE', (ctx) => {
    awaitingReason = true;
    ctx.reply('🚨 РЕЖИМ ТРЕВОГИ ИНИЦИИРОВАН.\nВведите причину угрозы для терминалов сотрудников (текстом):');
});

// Нажатие на Зеленую Кнопку
bot.hears('🟢 ВЕРНУТЬ STABLE', (ctx) => {
    currentSystemState = "NORMAL";
    customLabel = "ШТАТНЫЙ РЕЖИМ";
    incidentReason = ""; 
    awaitingReason = false;
    ctx.reply('✅ Система стабилизирована. Причина сброшена.', mainMenu);
});

bot.hears('📊 ТЕКУЩИЙ СТАТУС', (ctx) => {
    ctx.reply(`Состояние: ${currentSystemState}\nТекст: ${customLabel}\nПричина: ${incidentReason || "Нет"}`);
});

bot.hears('📝 ИЗМЕНИТЬ СТАТУС', (ctx) => {
    ctx.reply('Используйте команду: /setstatus ТЕКСТ');
});

// Команда для ручной смены текста статуса (не тревоги)
bot.command('setstatus', (ctx) => {
    const text = ctx.message.text.split(' ').slice(1).join(' ');
    if (!text) return ctx.reply('Используй: /setstatus ТЕКСТ');
    customLabel = text.toUpperCase();
    ctx.reply(`✅ Статус обновлен: ${customLabel}`);
});

// ОБРАБОТЧИК ТЕКСТА (Для ввода причины тревоги)
bot.on('text', (ctx) => {
    if (awaitingReason) {
        currentSystemState = "RED";
        customLabel = "КРИТИЧЕСКАЯ УГРОЗА";
        incidentReason = ctx.message.text; // Записываем причину
        awaitingReason = false;
        ctx.reply(`🚨 СТАТУС УСТАНОВЛЕН!\nПричина: ${incidentReason}\n\nВсе терминалы сотрудников получили уведомление.`);
    }
});

// === АНТИ-СОН (Keep-Alive) ===
setInterval(() => {
    axios.get(SERVER_URL).catch(() => console.log('Ping OK'));
}, 10 * 60 * 1000); // 10 минут

// === ЗАПУСК ===
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`P.R.I.S.M. Server started on port ${PORT}`);
    bot.launch();
});

// Остановка
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
