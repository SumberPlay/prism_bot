const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');
const CryptoJS = require('crypto-js');

const BOT_TOKEN = '7809111631:AAGO30xOzwdfZpuL_5ee5GhClmy_94w3UEI';
const ADMIN_CHAT_ID = '5681992508'; 

const app = express();
const bot = new Telegraf(BOT_TOKEN);

app.use(cors());
app.use(express.json());

// === ЦЕНТРАЛЬНАЯ БАЗА СОТРУДНИКОВ ===
let staffDB = {
    "M4SK": { 
        pass: "5e03fcd2d70a976a6b026374da5da3f9", 
        role: "scientific", level: 3, name: "МэнсиКейн", 
        mc_name: "MancyKane", dept: "Научный Департамент", 
        bio: "Ведущий специалист по изучению Объекта #001.",
        note: "Замечена повышенная активность. Рекомендовано наблюдение."
    },
    "KRMP": { 
        pass: "1bf502b835ee007957e558cbb1959ecb", 
        role: "military", level: 2, name: "Кримпи", 
        mc_name: "Krimpi", dept: "Военная Группа", 
        bio: "Командир оперативной группы.",
        note: "Прямое подчинение Совету в случае протокола 'ЗЕРО'."
    },
    "SUMBR": { 
        pass: "8aaa688aadaf78796f5f620a4897eeb3", 
        role: "council", level: 5, name: "Самбер", 
        mc_name: "SumberTheCreator", dept: "Высший Совет", 
        bio: "Основатель P.R.I.S.M. Личность засекречена.",
        note: "КЛЮЧ_ДОСТУПА: ВСЕ_СЕКТОРА. Инициирует протоколы очистки."
    },
    "MRYZE": { 
        pass: "b0eee0a274f64e6f5792b85c93321159", 
        role: "council", level: 5, name: "Юз", 
        mc_name: "MrYuze", dept: "Высший Совет", 
        bio: "Глава аналитического отдела Совета.",
        note: "КЛЮЧ_ДОСТУПА: ВСЕ_СЕКТОРА. Ответственный за внешние связи."
    }
};

let systemStatus = { state: "NORMAL", label: "ШТАТНЫЙ РЕЖИМ", color: "#00ffcc", reason: "" };
const userStates = new Map();

// === API ДЛЯ САЙТА ===

// НОВЫЙ ЭНДПОИНТ ЛОГИНА (ВАРИАНТ А)
app.post('/login', (req, res) => {
    const { id, pass } = req.body;
    const user = staffDB[id];
    if (user && user.pass === pass) {
        res.json({ success: true, level: user.level, name: user.name });
    } else {
        res.status(401).json({ success: false, message: "Отказ в доступе" });
    }
});

app.get('/status', (req, res) => res.json(systemStatus));

app.get('/get-staff', (req, res) => {
    const safeDB = {};
    for (let id in staffDB) {
        safeDB[id] = {
            name: staffDB[id].name,
            level: staffDB[id].level,
            dept: staffDB[id].dept,
            mc_name: staffDB[id].mc_name
        };
    }
    res.json(safeDB);
});

app.get('/get-bio/:id', (req, res) => {
    const user = staffDB[req.params.id];
    res.json({ bio: user ? user.bio : "ДАННЫЕ ОТСУТСТВУЮТ" });
});

app.post('/auth-log', (req, res) => {
    const { id, name, level } = req.body;
    const logMsg = `👤 **АВТОРИЗАЦИЯ**\n━━━━━━━━━━━━━━\nID: \`${id}\`\nИмя: **${name}**\nДопуск: **L${level}**\n━━━━━━━━━━━━━━\nСистема: Доступ разрешен.`;
    bot.telegram.sendMessage(ADMIN_CHAT_ID, logMsg, { parse_mode: 'Markdown' });
    res.json({ success: true });
});

// === КОМАНДЫ БОТА ===
const mainMenu = Markup.keyboard([['🔴 RED CODE', '🟢 STABLE'], ['✍️ СТАТУС', '👥 ПЕРСОНАЛ'], ['📊 ТЕКУЩИЙ СТАТУС']]).resize();

bot.start((ctx) => ctx.reply('🛡️ Терминал управления P.R.I.S.M. активен.', mainMenu));

bot.hears('👥 ПЕРСОНАЛ', (ctx) => {
    let list = "📂 **РЕЕСТР СОТРУДНИКОВ:**\n\n";
    Object.keys(staffDB).forEach(id => { list += `🔹 \`${id}\` — ${staffDB[id].name} (L${staffDB[id].level})\n`; });
    ctx.reply(list, { parse_mode: 'Markdown' });
});

bot.hears('🔴 RED CODE', (ctx) => {
    userStates.set(ctx.from.id, 'WAITING_FOR_REASON');
    ctx.reply('🚨 Введите причину активации КРАСНОГО КОДА:', Markup.removeKeyboard());
});

bot.hears('🟢 STABLE', (ctx) => {
    systemStatus = { state: "NORMAL", label: "ШТАТНЫЙ РЕЖИМ", color: "#00ffcc", reason: "" };
    ctx.reply('✅ Система в штатном режиме.', mainMenu);
});

bot.on('text', async (ctx, next) => {
    const userId = ctx.from.id;
    if (userStates.get(userId) === 'WAITING_FOR_REASON') {
        systemStatus = { state: "RED", label: "🚨 КРИТИЧЕСКОЕ СОСТОЯНИЕ", color: "#ff4444", reason: ctx.message.text };
        userStates.delete(userId);
        await ctx.reply(`⚠️ RED CODE УСТАНОВЛЕН`, mainMenu);
        bot.telegram.sendMessage(ADMIN_CHAT_ID, `‼️ **ALARM: RED CODE**\n🔴 **Причина:** ${systemStatus.reason}`, { parse_mode: 'Markdown' });
        return;
    }
    return next();
});

bot.launch().then(() => console.log('P.R.I.S.M. System Online'));
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`API port: ${PORT}`));
