const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

// === НАСТРОЙКИ (ЗАПОЛНИ СВОИ ДАННЫЕ) ===
const BOT_TOKEN = '7809111631:AAGO30xOzwdfZpuL_5ee5GhClmy_94w3UEI';
const ADMIN_CHAT_ID = '5681992508'; // Узнай в @userinfobot
const SERVER_URL = 'https://prism-bot.onrender.com'; 

const app = express();
const bot = new Telegraf(BOT_TOKEN);

// Состояние системы
let currentSystemState = "NORMAL";
let customLabel = "ШТАТНЫЙ РЕЖИМ";

// === НАСТРОЙКА СЕРВЕРА ===
app.use(cors()); 
app.use(express.json());
app.use(express.static(__dirname)); // Раздает файлы из корня (index.html и т.д.)

// Главная страница (исправляет Cannot GET /)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API для синхронизации сайта
app.get('/status', (req, res) => {
    res.json({
        state: currentSystemState,
        label: customLabel,
        color: currentSystemState === "RED" ? "#ff3300" : "#00ffcc"
    });
});

// Прием рапортов с сайта
app.post('/send-report', (req, res) => {
    const { user, subject, text, timestamp } = req.body;
    const report = `📝 **НОВЫЙ РАПОРТ P.R.I.S.M.**\n👤 От: ${user}\n📋 Тема: ${subject}\n⏰ Время: ${timestamp}\n\nСообщение:\n${text}`;
    
    bot.telegram.sendMessage(ADMIN_CHAT_ID, report, { parse_mode: 'Markdown' })
        .then(() => res.json({ success: true }))
        .catch(err => res.status(500).json({ success: false }));
});

// === ЛОГИКА БОТА С КНОПКАМИ ===

// Главное меню управления
const mainMenu = Markup.keyboard([
    ['🔴 АКТИВИРОВАТЬ RED CODE', '🟢 ВЕРНУТЬ STABLE'],
    ['📝 ИЗМЕНИТЬ СТАТУС', '📊 ТЕКУЩИЙ СТАТУС']
]).resize();

bot.start((ctx) => {
    ctx.reply('🛡️ Терминал P.R.I.S.M. приветствует вас, офицер.\nИспользуйте панель управления:', mainMenu);
});

bot.hears('🔴 АКТИВИРОВАТЬ RED CODE', (ctx) => {
    currentSystemState = "RED";
    customLabel = "КРИТИЧЕСКАЯ УГРОЗА";
    ctx.reply('🚨 ВНИМАНИЕ: Объявлен RED CODE на всех мониторах!');
});

bot.hears('🟢 ВЕРНУТЬ STABLE', (ctx) => {
    currentSystemState = "NORMAL";
    customLabel = "ШТАТНЫЙ РЕЖИМ";
    ctx.reply('✅ Система переведена в штатный режим.');
});

bot.hears('📊 ТЕКУЩИЙ СТАТУС', (ctx) => {
    ctx.reply(`Статус: ${currentSystemState}\nТекст: ${customLabel}`);
});

// Кастомный статус через команду
bot.command('setstatus', (ctx) => {
    const text = ctx.message.text.split(' ').slice(1).join(' ');
    if (!text) return ctx.reply('⚠️ Ошибка. Используйте: /setstatus ТЕКСТ');
    customLabel = text.toUpperCase();
    ctx.reply(`✅ Новый статус установлен: ${customLabel}`);
});

// Кастомный статус через кнопку (подсказка)
bot.hears('📝 ИЗМЕНИТЬ СТАТУС', (ctx) => {
    ctx.reply('Чтобы изменить текст, отправьте команду:\n`/setstatus ТВОЙ ТЕКСТ`', { parse_mode: 'Markdown' });
});

// === ПОДДЕРЖАНИЕ ЖИЗНИ (ANTI-SLEEP) ===
setInterval(async () => {
    try {
        await axios.get(SERVER_URL);
        console.log('[Self-Ping] Будильник сработал, сервер не спит.');
    } catch (e) {
        console.log('[Self-Ping] Ошибка пинга, но сервер жив.');
    }
}, 13 * 60 * 1000); // Каждые 13 минут

// === ЗАПУСК ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`P.R.I.S.M. Server active on port ${PORT}`);
    bot.launch();
});

// Безопасная остановка
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
