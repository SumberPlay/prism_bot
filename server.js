const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');
const fs = require('fs');
const crypto = require('crypto');

// === НАСТРОЙКИ ===
const BOT_TOKEN = '7809111631:AAGO30xOzwdfZpuL_5ee5GhClmy_94w3UEI';
const ADMIN_CHAT_ID = '5681992508'; // Сюда будут падать рапорты
const DATA_FILE = './staff.json'; 

const app = express();
const bot = new Telegraf(BOT_TOKEN);

if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}));
}

let currentSystemState = "NORMAL";
let customLabel = "ШТАТНЫЙ РЕЖИМ";

app.use(cors());
app.use(express.json());

// === API ДЛЯ САЙТА ===

app.post('/api/login', (req, res) => {
    const { uid, passwordMD5 } = req.body;
    const db = JSON.parse(fs.readFileSync(DATA_FILE));
    const user = db[uid.toUpperCase()];

    if (user && user.pass === passwordMD5) {
        // ДОБАВИЛ: Возвращаем роль сотрудника для отображения кнопок
        res.json({ 
            success: true, 
            level: user.level, 
            name: user.name, 
            role: user.role || "scientific" // Если роли нет, даем базу
        });
    } else {
        res.json({ success: false });
    }
});

// Отправка рапорта с сайта в Telegram
app.post('/send-report', (req, res) => {
    const { user, subject, text, timestamp } = req.body;
    const reportMsg = `📩 **НОВЫЙ РАПОРТ**\n👤 От: ${user}\n📝 Тема: ${subject}\n🕒 Время: ${timestamp}\n\n${text}`;
    
    bot.telegram.sendMessage(ADMIN_CHAT_ID, reportMsg, { parse_mode: 'Markdown' });
    res.json({ success: true });
});

app.get('/get-external-staff', (req, res) => {
    const db = JSON.parse(fs.readFileSync(DATA_FILE));
    const staffArray = Object.keys(db).map(id => ({ id, ...db[id] }));
    res.json(staffArray);
});

app.get('/status', (req, res) => {
    res.json({ 
        state: currentSystemState, 
        label: customLabel, 
        color: currentSystemState === "RED" ? "#ff4444" : "#00ffcc" 
    });
});

// === ЛОГИКА БОТА ===

const mainMenu = Markup.keyboard([
    ['👥 ПЕРСОНАЛ', '📊 СТАТУС'],
    ['🔴 RED CODE', '🟢 STABLE']
]).resize();

bot.start((ctx) => ctx.reply('🛡️ Терминал управления P.R.I.S.M.', mainMenu));

bot.hears('👥 ПЕРСОНАЛ', (ctx) => {
    ctx.reply('Управление сотрудниками:\n\n' +
              '➕ **Добавить:** `/reg ID | Пароль | Имя | Скин | Лвл | Роль | Био`\n' +
              '🔍 **Инфо:** `/check ID`\n' +
              '🗑️ **Удалить:** `/del ID`\n\n' +
              '_Роли: scientific, military, council_', { parse_mode: 'Markdown' });
});

// Исправленная команда регистрации с РОЛЬЮ
bot.command('reg', (ctx) => {
    const text = ctx.message.text.split('/reg ')[1];
    if (!text) return ctx.reply('Используй: /reg ID | Пароль | Имя | Скин | Лвл | Роль | Био');

    const [id, pass, name, skin, level, role, bio] = text.split('|').map(s => s.trim());
    if (!id || !pass || !name || !level || !role) {
        return ctx.reply('❌ Ошибка! ID, Пасс, Имя, Лвл и Роль обязательны.');
    }

    const db = JSON.parse(fs.readFileSync(DATA_FILE));
    const md5Pass = crypto.createHash('md5').update(pass).digest('hex');

    db[id.toUpperCase()] = {
        pass: md5Pass,
        name: name,
        skin: skin || "Steve",
        level: parseInt(level),
        role: role.toLowerCase(), // scientific, military, council
        bio: bio || "Нет данных.",
        status: "ACTIVE"
    };

    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
    ctx.reply(`✅ Сотрудник [${id.toUpperCase()}] обновлен.\nРоль: ${role}\nДоступ: Lvl ${level}`);
});

bot.command('check', (ctx) => {
    const id = ctx.message.text.split('/check ')[1]?.toUpperCase();
    const db = JSON.parse(fs.readFileSync(DATA_FILE));
    const user = db[id];
    if (!user) return ctx.reply('❌ Не найден.');
    ctx.reply(`📊 ДАННЫЕ ${id}:\n\nИмя: ${user.name}\nРоль: ${user.role}\nДоступ: ${user.level} лвл\nБио: ${user.bio}`);
});

bot.command('del', (ctx) => {
    const id = ctx.message.text.split('/del ')[1]?.toUpperCase();
    const db = JSON.parse(fs.readFileSync(DATA_FILE));
    if (db[id]) {
        delete db[id];
        fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
        ctx.reply(`⚠️ Аккаунт ${id} удален.`);
    }
});

// Управление статусами
bot.hears('🔴 RED CODE', (ctx) => {
    currentSystemState = "RED";
    customLabel = "🚨 ОБЪЯВЛЕН RED CODE 🚨";
    ctx.reply('🚨 СИСТЕМА ПЕРЕВЕДЕНА В РЕЖИМ ТРЕВОГИ!');
});

bot.hears('🟢 STABLE', (ctx) => {
    currentSystemState = "NORMAL";
    customLabel = "ШТАТНЫЙ РЕЖИМ";
    ctx.reply('✅ СИТУАЦИЯ СТАБИЛИЗИРОВАНА.');
});

bot.launch();
app.listen(process.env.PORT || 10000, () => console.log('Server is running...'));
