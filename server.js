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
        spec: "Аномалии", joined: "03.01.2026",
        bio: "Ведущий специалист по изучению Объекта #001.",
        note: "Замечена повышенная активность. Рекомендовано наблюдение."
    },
    "KRMP": { 
        pass: "1bf502b835ee007957e558cbb1959ecb", 
        role: "military", level: 2, name: "Кримпи", 
        mc_name: "Krimpi", dept: "Военная Группа", 
        spec: "Тактика", joined: "03.01.2026",
        bio: "Командир оперативной группы.",
        note: "Прямое подчинение Совету в случае протокола 'ЗЕРО'."
    },
    "SUMBR": { 
        pass: "8aaa688aadaf78796f5f620a4897eeb3", 
        role: "council", level: 5, name: "Самбер", 
        mc_name: "SumberTheCreator", dept: "Высший Совет", 
        spec: "Куратор", joined: "С основания",
        bio: "Основатель P.R.I.S.M. Личность засекречена.",
        note: "КЛЮЧ_ДОСТУПА: ВСЕ_СЕКТОРА. Инициирует протоколы очистки."
    },
    "MRYZE": { 
        pass: "b0eee0a274f64e6f5792b85c93321159", 
        role: "council", level: 5, name: "Юз", 
        mc_name: "MrYuze", dept: "Высший Совет", 
        spec: "Стратег", joined: "С основания",
        bio: "Глава аналитического отдела Совета.",
        note: "КЛЮЧ_ДОСТУПА: ВСЕ_СЕКТОРА. Ответственный за внешние связи."
    }
};

let systemStatus = {
    state: "NORMAL",
    label: "ШТАТНЫЙ РЕЖИМ",
    color: "#00ffcc",
    reason: ""
};

const userStates = new Map();

// === API ДЛЯ САЙТА ===

app.get('/status', (req, res) => res.json(systemStatus));

// 1. БЕЗОПАСНЫЙ СПИСОК (БЕЗ ПАРОЛЕЙ И БИО)
app.get('/get-staff', (req, res) => {
    const safeDB = {};
    for (let id in staffDB) {
        safeDB[id] = {
            name: staffDB[id].name,
            level: staffDB[id].level,
            role: staffDB[id].role,
            dept: staffDB[id].dept,
            mc_name: staffDB[id].mc_name
        };
    }
    res.json(safeDB);
});

// 2. ПОЛУЧЕНИЕ БИОГРАФИИ (ДЛЯ DOSSIER)
app.get('/get-bio/:id', (req, res) => {
    const id = req.params.id;
    if (staffDB[id]) {
        res.json({ bio: staffDB[id].bio });
    } else {
        res.status(404).json({ bio: "ДАННЫЕ_ОТСУТСТВУЮТ" });
    }
});

// 3. ПОЛУЧЕНИЕ ЗАМЕТКИ (ТОЛЬКО ДЛЯ СОВЕТА)
app.get('/get-note/:id', (req, res) => {
    const id = req.params.id;
    const requesterLevel = req.query.lvl;

    if (requesterLevel >= 5) {
        res.json({ note: staffDB[id] ? staffDB[id].note : "НЕТ_ДАННЫХ" });
    } else {
        res.status(403).json({ note: "ОШИБКА_ДОСТУПА" });
    }
});

app.post('/auth-log', (req, res) => {
    const { id, name, level } = req.body;
    const logMsg = `👤 **АВТОРИЗАЦИЯ**\n━━━━━━━━━━━━━━\nID: \`${id}\`\nИмя: **${name}**\nДопуск: **L${level}**\n━━━━━━━━━━━━━━\nСистема: Доступ разрешен.`;
    bot.telegram.sendMessage(ADMIN_CHAT_ID, logMsg, { parse_mode: 'Markdown' });
    res.json({ success: true });
});

app.post('/send-report', (req, res) => {
    const { user, text, timestamp } = req.body;
    const reportMsg = `📩 **НОВЫЙ РАПОРТ**\n━━━━━━━━━━━━━━\n👤 **От:** ${user}\n🕒 **Время:** ${timestamp}\n━━━━━━━━━━━━━━\n${text}`;
    bot.telegram.sendMessage(ADMIN_CHAT_ID, reportMsg, { parse_mode: 'Markdown' });
    res.json({ success: true });
});

// === КОМАНДЫ БОТА ===
// (Тут оставляем твой старый код без изменений)
const mainMenu = Markup.keyboard([
    ['🔴 RED CODE', '🟢 STABLE'],
    ['✍️ СТАТУС', '👥 ПЕРСОНАЛ'],
    ['📊 ТЕКУЩИЙ СТАТУС']
]).resize();

bot.start((ctx) => ctx.reply('🛡️ Терминал управления P.R.I.S.M. активен.', mainMenu));

bot.hears('👥 ПЕРСОНАЛ', (ctx) => {
    let list = "📂 **РЕЕСТР СОТРУДНИКОВ:**\n\n";
    Object.keys(staffDB).forEach(id => {
        list += `🔹 \`${id}\` — ${staffDB[id].name} (L${staffDB[id].level})\n`;
    });
    list += "\nДля правки примечания: `/set_note ID Текст`";
    ctx.reply(list, { parse_mode: 'Markdown' });
});

bot.command('set_note', (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 3) return ctx.reply('Формат: /set_note ID Новый текст примечания');
    const targetId = args[1].toUpperCase();
    const newNote = args.slice(2).join(' ');
    if (staffDB[targetId]) {
        staffDB[targetId].note = newNote;
        ctx.reply(`✅ Примечание для **${staffDB[targetId].name}** обновлено.`);
    } else { ctx.reply('❌ Сотрудник с таким ID не найден.'); }
});

bot.hears('🔴 RED CODE', (ctx) => {
    userStates.set(ctx.from.id, 'WAITING_FOR_REASON');
    ctx.reply('🚨 Введите причину активации КРАСНОГО КОДА:', Markup.removeKeyboard());
});

bot.hears('🟢 STABLE', (ctx) => {
    systemStatus = { state: "NORMAL", label: "ШТАТНЫЙ РЕЖИМ", color: "#00ffcc", reason: "" };
    ctx.reply('✅ Система в штатном режиме.', mainMenu);
});

bot.hears('📊 ТЕКУЩИЙ СТАТУС', (ctx) => {
    let message = `📊 **Статус:** ${systemStatus.label}\n`;
    if (systemStatus.reason) message += `📝 **Причина:** ${systemStatus.reason}`;
    ctx.reply(message, { parse_mode: 'Markdown' });
});

bot.on('text', async (ctx, next) => {
    const userId = ctx.from.id;
    const state = userStates.get(userId);
    if (state === 'WAITING_FOR_REASON') {
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
