const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');

// === НАСТРОЙКИ ===
const BOT_TOKEN = '7809111631:AAGO30xOzwdfZpuL_5ee5GhClmy_94w3UEI';
const ADMIN_CHAT_ID = '5681992508';
const SERVER_URL = 'https://prism-bot.onrender.com'; 
const DATA_FILE = './externalStaff.json';

const app = express();
const bot = new Telegraf(BOT_TOKEN);

// Инициализация базы данных (файла)
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

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

// Статус для терминалов и досье
app.get('/status', (req, res) => {
    res.json({
        state: currentSystemState,
        label: customLabel,
        color: currentSystemState === "RED" ? "#ff4444" : "#00ffcc",
        reason: incidentReason
    });
});

// Получение списка игроков из файла
app.get('/get-external-staff', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE));
        res.json(data);
    } catch (e) {
        res.json([]);
    }
});

// Прием рапортов с сайта
app.post('/send-report', (req, res) => {
    const { user, subject, text, timestamp } = req.body;
    const report = `📝 **НОВЫЙ РАПОРТ P.R.I.S.M.**\n👤 От: ${user}\n📋 Тема: ${subject}\n⏰ Время: ${timestamp}\n\nСообщение:\n${text}`;
    
    bot.telegram.sendMessage(ADMIN_CHAT_ID, report, { parse_mode: 'Markdown' })
        .then(() => res.json({ success: true }))
        .catch(err => {
            console.error('Ошибка в TG:', err);
            res.status(500).json({ success: false });
        });
});

// === ЛОГИКА ТЕЛЕГРАМ-БОТА ===

// Клавиатуры
const mainMenu = Markup.keyboard([
    ['🔴 RED CODE', '🟢 STABLE'],
    ['👤 УПРАВЛЕНИЕ ДОСЬЕ', '📊 СТАТУС'],
    ['📝 ИЗМЕНИТЬ ТЕКСТ СТАТУСА']
]).resize();

const dossierMenu = Markup.keyboard([
    ['➕ ДОБАВИТЬ', '🗑️ УДАЛИТЬ'],
    ['🧹 ОЧИСТКА БАЗЫ', '🔙 НАЗАД']
]).resize();

bot.start((ctx) => {
    ctx.reply('🛡️ Терминал P.R.I.S.M. активен. Доступ разрешен.', mainMenu);
});

// --- СЕКЦИЯ RED CODE ---
bot.hears('🔴 RED CODE', (ctx) => {
    awaitingReason = true;
    ctx.reply('🚨 РЕЖИМ ТРЕВОГИ.\nВведите причину угрозы:');
});

bot.hears('🟢 STABLE', (ctx) => {
    currentSystemState = "NORMAL";
    customLabel = "ШТАТНЫЙ РЕЖИМ";
    incidentReason = ""; 
    awaitingReason = false;
    ctx.reply('✅ Система стабилизирована.', mainMenu);
});

// --- СЕКЦИЯ ДОСЬЕ ---
bot.hears('👤 УПРАВЛЕНИЕ ДОСЬЕ', (ctx) => {
    ctx.reply('🗄️ Управление персоналом. Выберите действие:', dossierMenu);
});

bot.hears('➕ ДОБАВИТЬ', (ctx) => {
    ctx.reply('Чтобы добавить игрока, введите команду:\n\n`/add Имя | Скин | Лвл | Био`', { parse_mode: 'Markdown' });
});

bot.hears('🗑️ УДАЛИТЬ', (ctx) => {
    ctx.reply('Чтобы удалить игрока, введите:\n\n`/del Имя`', { parse_mode: 'Markdown' });
});

bot.command('add', (ctx) => {
    const text = ctx.message.text.split('/add ')[1];
    if (!text) return ctx.reply('❌ Ошибка. Формат: `/add Имя | Скин | Лвл | Био`', { parse_mode: 'Markdown' });

    const [name, skin, level, bio] = text.split('|').map(s => s.trim());
    if (!name || !skin || !level) return ctx.reply('❌ Заполни минимум Имя, Скин и Лвл.');

    const players = JSON.parse(fs.readFileSync(DATA_FILE));
    players.push({
        id: Date.now(),
        name,
        skin,
        level: parseInt(level),
        bio: bio || "Нет описания.",
        status: "ACTIVE"
    });
    fs.writeFileSync(DATA_FILE, JSON.stringify(players, null, 2));
    ctx.reply(`✅ Сотрудник ${name} добавлен.`);
});

bot.command('del', (ctx) => {
    const name = ctx.message.text.split('/del ')[1];
    if (!name) return ctx.reply('Укажите имя игрока.');

    let players = JSON.parse(fs.readFileSync(DATA_FILE));
    const newPlayers = players.filter(p => !p.name.toLowerCase().includes(name.toLowerCase()));
    
    if (players.length !== newPlayers.length) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(newPlayers, null, 2));
        ctx.reply(`⚠️ ${name} удален из базы.`);
    } else {
        ctx.reply('❌ Игрок не найден.');
    }
});

bot.command('clear_base', (ctx) => {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]));
    ctx.reply('🚨 База внешних игроков очищена.');
});

bot.hears('🧹 ОЧИСТКА БАЗЫ', (ctx) => ctx.reply('Используй команду `/clear_base` для подтверждения.'));

// --- СТАТУСЫ И ПРОЧЕЕ ---
bot.hears('📊 СТАТУС', (ctx) => {
    ctx.reply(`📊 СТАТУС:\nСостояние: ${currentSystemState}\nТекст: ${customLabel}\nПричина: ${incidentReason || "—"}`);
});

bot.hears('📝 ИЗМЕНИТЬ ТЕКСТ СТАТУСА', (ctx) => {
    ctx.reply('Введите `/setstatus Текст`');
});

bot.command('setstatus', (ctx) => {
    const text = ctx.message.text.split('/setstatus ')[1];
    if (!text) return ctx.reply('Введите текст статуса.');
    customLabel = text.toUpperCase();
    ctx.reply(`✅ Статус изменен: ${customLabel}`);
});

bot.hears('🔙 НАЗАД', (ctx) => ctx.reply('Главное меню', mainMenu));

// Обработка ввода причины RED CODE
bot.on('text', (ctx) => {
    if (awaitingReason) {
        currentSystemState = "RED";
        customLabel = "КРИТИЧЕСКАЯ УГРОЗА";
        incidentReason = ctx.message.text; 
        awaitingReason = false;
        ctx.reply(`🚨 СИСТЕМА ПЕРЕВЕДЕНА В RED CODE!\nПричина: ${incidentReason}`, mainMenu);
    }
});

// === АНТИ-СОН ===
setInterval(() => {
    axios.get(SERVER_URL).catch(() => console.log('Ping...'));
}, 10 * 60 * 1000); 

// === ЗАПУСК ===
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
    bot.launch()
        .then(() => console.log('Bot OK'))
        .catch(err => console.error('Bot Error:', err));
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
