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

// === БАЗА ДОСТУПА (StaffDB) ===
// Добавил поля dept, bio, note, чтобы они корректно отображались в твоем терминале
let staffDB = {
    "M4SK": { 
        pass: "5e03fcd2d70a976a6b026374da5da3f9", 
        role: "scientific", level: 3, name: "МэнсиКейн",
        dept: "НАУЧНЫЙ ОТДЕЛ", bio: "ВЕДУЩИЙ КУРАТОР", note: "ДОПУСК К СЕКТОРУ B"
    },
    "KRMP": { 
        pass: "1bf502b835ee007957e558cbb1959ecb", 
        role: "military", level: 2, name: "Кримпи",
        dept: "СЛУЖБА БЕЗОПАСНОСТИ", bio: "ОФИЦЕР СВЯЗИ", note: "ПАТРУЛЬ ПЕРИМЕТРА"
    },
    "SUMBR": { 
        pass: "8aaa688aadaf78796f5f620a4897eeb3", 
        role: "council", level: 5, name: "Самбер",
        dept: "ВЫСШИЙ СОВЕТ", bio: "ОСНОВАТЕЛЬ P.R.I.S.M.", note: "ПОЛНЫЙ ДОСТУП"
    },
    "MRYZE": { 
        pass: "b0eee0a274f64e6f5792b85c93321159", 
        role: "council", level: 5, name: "Юз",
        dept: "ВЫСШИЙ СОВЕТ", bio: "ГЛАВА АНАЛИТИКИ", note: "КУРАТОР ПРОЕКТОВ"
    }
};

// === БАЗА НАБЛЮДЕНИЯ (PlayerDB) ===
let playerDB = {
    "M4SK": { role: "scientific", level: 3, name: "ТЕст1", mc_name: "m4skine_", dept: "Научный Департамент", bio: "Ведущий специалист по изучению Объекта #001.", note: "Замечена повышенная активность." },
    "KRMP": { role: "military", level: 2, name: "ТЕст2", mc_name: "Krimpi", dept: "Военная Группа", bio: "Командир оперативной группы.", note: "Прямое подчинение Совету." },
    "SUMBR": { role: "council", level: 5, name: "ТЕст3", mc_name: "SumberTheCreator", dept: "Высший Совет", bio: "Основатель P.R.I.S.M.", note: "КЛЮЧ_ДОСТУПА: ВСЕ_СЕКТОРА." },
    "MRYZE": { role: "council", level: 5, name: "ТЕст4", mc_name: "MrYuze", dept: "Высший Совет", bio: "Глава аналитического отдела.", note: "Ответственный за внешние связи." }
};

let systemStatus = { state: "NORMAL", label: "ШТАТНЫЙ РЕЖИМ", color: "#00ffcc", reason: "" };
const userStates = new Map();

// === API ДЛЯ САЙТА ===

// 1. ЛОГИН
app.post('/login', (req, res) => {
    const { id, pass } = req.body;
    const user = staffDB[id];
    if (user && user.pass === pass) {
        res.json({ success: true, level: user.level, name: user.name, role: user.role });
    } else {
        res.status(401).json({ success: false, message: "Отказ в доступе" });
    }
});

// 2. ЭНДПОИНТ ДЛЯ АДМИН-ПАНЕЛИ ( staff_list.html )
app.get('/get-admin-staff', (req, res) => {
    res.json(staffDB); 
});

// 3. ЭНДПОИНТ ДЛЯ ДОСЬЕ ИГРОКОВ ( dossier.html )
app.get('/get-staff', (req, res) => {
    const safeDB = {};
    for (let id in playerDB) {
        safeDB[id] = { 
            name: playerDB[id].name, 
            level: playerDB[id].level, 
            dept: playerDB[id].dept, 
            mc_name: playerDB[id].mc_name, 
            role: playerDB[id].role 
        };
    }
    res.json(safeDB);
});

app.get('/get-bio/:id', (req, res) => {
    const player = playerDB[req.params.id];
    res.json({ bio: player ? player.bio : "ДАННЫЕ ОТСУТСТВУЮТ" });
});

app.post('/auth-log', (req, res) => {
    const { id, name, level } = req.body;
    bot.telegram.sendMessage(ADMIN_CHAT_ID, `👤 **ВХОД В СИСТЕМУ**\nID: \`${id}\`\nИмя: **${name}**\nДопуск: **L${level}**`, { parse_mode: 'Markdown' });
    res.json({ success: true });
});

app.get('/status', (req, res) => res.json(systemStatus));

// === КОМАНДЫ БОТА ===
const mainMenu = Markup.keyboard([
    ['🔴 RED CODE', '🟢 STABLE'],
    ['👥 ДОСЬЕ', '👔 СОТРУДНИКИ'],
    ['📊 ТЕКУЩИЙ СТАТУС']
]).resize();

bot.start((ctx) => ctx.reply('🛡️ Терминал P.R.I.S.M. активен.', mainMenu));

bot.hears('👥 ДОСЬЕ', (ctx) => {
    let list = "📂 **РЕЕСТР СУБЪЕКТОВ (PlayerDB):**\n\n";
    Object.keys(playerDB).forEach(id => { 
        list += `🔹 \`${id}\` — ${playerDB[id].name} (L${playerDB[id].level})\n`; 
    });
    ctx.reply(list, { parse_mode: 'Markdown' });
});

bot.hears('👔 СОТРУДНИКИ', (ctx) => {
    let list = "🛡️ **РЕЕСТР ДОСТУПА (StaffDB):**\n\n";
    Object.keys(staffDB).forEach(id => { 
        const user = staffDB[id];
        list += `🔸 \`${id}\` — ${user.name} (L${user.level}, ключ: \`${user.pass}\`)\n`; 
    });
    ctx.reply(list, { parse_mode: 'Markdown' });
});

bot.hears('🔴 RED CODE', (ctx) => {
    userStates.set(ctx.from.id, 'WAITING_FOR_REASON');
    ctx.reply('🚨 Введите причину:', Markup.removeKeyboard());
});

bot.hears('🟢 STABLE', (ctx) => {
    systemStatus = { state: "NORMAL", label: "ШТАТНЫЙ РЕЖИМ", color: "#00ffcc", reason: "" };
    ctx.reply('✅ Статус обновлен.', mainMenu);
});

bot.on('text', async (ctx, next) => {
    if (userStates.get(ctx.from.id) === 'WAITING_FOR_REASON') {
        systemStatus = { state: "RED", label: "🚨 КРИТИЧЕСКОЕ СОСТОЯНИЕ", color: "#ff4444", reason: ctx.message.text };
        userStates.delete(ctx.from.id);
        await ctx.reply(`⚠️ СТАТУС: RED CODE`, mainMenu);
        return;
    }
    return next();
});

bot.launch();

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server online on port ${PORT}`));
