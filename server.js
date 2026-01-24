const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');

// === НАСТРОЙКИ ===
const BOT_TOKEN = '7809111631:AAGO30xOzwdfZpuL_5ee5GhClmy_94w3UEI';
const ADMIN_CHAT_ID = '5681992508';
const SERVER_URL = 'https://prism-bot.onrender.com'; 
const DATA_FILE = './staff.json'; // Единая база сотрудников

const app = express();
const bot = new Telegraf(BOT_TOKEN);

if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}));
}

let currentSystemState = "NORMAL";
let customLabel = "ШТАТНЫЙ РЕЖИМ";
let incidentReason = ""; 

app.use(cors());
app.use(express.json());

// === API ДЛЯ САЙТА ===

// Проверка логина (сайт вызывает этот эндпоинт)
app.post('/api/login', (req, res) => {
    const { uid, passwordMD5 } = req.body;
    const db = JSON.parse(fs.readFileSync(DATA_FILE));
    const user = db[uid.toUpperCase()];

    if (user && user.pass === passwordMD5) {
        res.json({ success: true, level: user.level, name: user.name });
    } else {
        res.json({ success: false });
    }
});

// Получение списка для страницы досье
app.get('/get-external-staff', (req, res) => {
    const db = JSON.parse(fs.readFileSync(DATA_FILE));
    // Превращаем объект в массив для сайта
    const staffArray = Object.keys(db).map(id => ({
        id,
        ...db[id]
    }));
    res.json(staffArray);
});

app.get('/status', (req, res) => {
    res.json({ state: currentSystemState, label: customLabel, color: currentSystemState === "RED" ? "#ff4444" : "#00ffcc" });
});

// === ЛОГИКА БОТА ===

const mainMenu = Markup.keyboard([
    ['👥 ПЕРСОНАЛ', '📊 СТАТУС'],
    ['🔴 RED CODE', '🟢 STABLE']
]).resize();

bot.start((ctx) => ctx.reply('🛡️ Терминал управления персоналом P.R.I.S.M.', mainMenu));

bot.hears('👥 ПЕРСОНАЛ', (ctx) => {
    ctx.reply('Управление сотрудниками:\n\n' +
              '➕ **Добавить/Изм:** `/reg ID | Пароль | Имя | Скин | Лвл | Био`\n' +
              '🔍 **Инфо:** `/check ID`\n' +
              '🗑️ **Удалить:** `/del ID`\n\n' +
              '_Пример: /reg M4SK | 12345 | Мэнси | M4SK | 3 | Научный сотрудник_', { parse_mode: 'Markdown' });
});

// Команда регистрации/редактирования
bot.command('reg', (ctx) => {
    const text = ctx.message.text.split('/reg ')[1];
    if (!text) return ctx.reply('Используй: /reg ID | Пароль | Имя | Скин | Лвл | Био');

    const [id, pass, name, skin, level, bio] = text.split('|').map(s => s.trim());
    if (!id || !pass || !name || !level) return ctx.reply('❌ Ошибка! ID, Пароль, Имя и Уровень обязательны.');

    const db = JSON.parse(fs.readFileSync(DATA_FILE));
    const md5Pass = crypto.createHash('md5').update(pass).digest('hex');

    db[id.toUpperCase()] = {
        pass: md5Pass,
        name: name,
        skin: skin || "Steve",
        level: parseInt(level),
        bio: bio || "Нет данных.",
        status: "ACTIVE"
    };

    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
    ctx.reply(`✅ Сотрудник [${id.toUpperCase()}] обновлен в базе.\nДоступ на сайт: разрешен (Lvl ${level})`);
});

bot.command('check', (ctx) => {
    const id = ctx.message.text.split('/check ')[1]?.toUpperCase();
    const db = JSON.parse(fs.readFileSync(DATA_FILE));
    const user = db[id];

    if (!user) return ctx.reply('❌ Сотрудник не найден.');
    ctx.reply(`📊 ДАННЫЕ ${id}:\n\nИмя: ${user.name}\nДоступ: ${user.level} лвл\nСкин: ${user.skin}\nБио: ${user.bio}`);
});

bot.command('del', (ctx) => {
    const id = ctx.message.text.split('/del ')[1]?.toUpperCase();
    const db = JSON.parse(fs.readFileSync(DATA_FILE));
    if (db[id]) {
        delete db[id];
        fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
        ctx.reply(`⚠️ Аккаунт ${id} удален.`);
    } else {
        ctx.reply('❌ Не найден.');
    }
});

// Остальные функции (RED CODE) остаются такими же...
bot.hears('🔴 RED CODE', (ctx) => { ctx.reply('🚨 Введите причину (текстом):'); }); // Упростил для примера

bot.launch();
app.listen(process.env.PORT || 10000);
