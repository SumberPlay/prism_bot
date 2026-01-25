const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');

const BOT_TOKEN = '7809111631:AAGO30xOzwdfZpuL_5ee5GhClmy_94w3UEI';
const ADMIN_CHAT_ID = '5681992508'; 

const app = express();
const bot = new Telegraf(BOT_TOKEN);

app.use(cors());
app.use(express.json());

// Хранилище ID сообщений для удаления
const chatHistory = new Map();

// Функция для записи ID сообщения
const trackMsg = (ctx, msg) => {
    if (!chatHistory.has(ctx.chat.id)) chatHistory.set(ctx.chat.id, []);
    chatHistory.get(ctx.chat.id).push(msg.message_id);
};

// === БАЗЫ ДАННЫХ ===
let staffDB = {
    "M4SK": { pass: "5e03fcd2d70a976a6b026374da5da3f9", role: "scientific", level: 3, name: "МэнсиКейн", dept: "НАУЧНЫЙ ОТДЕЛ", bio: "ВЕДУЩИЙ КУРАТОР", note: "ДОПУСК К СЕКТОРУ B" },
    "KRMP": { pass: "1bf502b835ee007957e558cbb1959ecb", role: "military", level: 2, name: "Кримпи", dept: "СЛУЖБА БЕЗОПАСНОСТИ", bio: "ОФИЦЕР СВЯЗИ", note: "ПАТРУЛЬ ПЕРИМЕТРА" },
    "SUMBR": { pass: "8aaa688aadaf78796f5f620a4897eeb3", role: "council", level: 5, name: "Самбер", dept: "ВЫСШИЙ СОВЕТ", bio: "ОСНОВАТЕЛЬ P.R.I.S.M.", note: "ПОЛНЫЙ ДОСТУП" },
    "MRYZE": { pass: "b0eee0a274f64e6f5792b85c93321159", role: "council", level: 5, name: "Юз", dept: "ВЫСШИЙ СОВЕТ", bio: "ГЛАВА АНАЛИТИКИ", note: "КУРАТОР ПРОЕКТОВ" }
};

let playerDB = {
    "M4SK": { role: "scientific", level: 3, name: "ТЕст1", mc_name: "m4skine_", dept: "Научный Департамент", bio: "Специалист по Объекту #001.", note: "Активность повышена." },
    "KRMP": { role: "military", level: 2, name: "ТЕст2", mc_name: "Krimpi", dept: "Военная Группа", bio: "Командир группы.", note: "Подчинение Совету." },
    "SUMBR": { role: "council", level: 5, name: "ТЕст3", mc_name: "SumberTheCreator", dept: "Высший Совет", bio: "Основатель.", note: "КЛЮЧ: ВСЕ СЕКТОРА." },
    "MRYZE": { role: "council", level: 5, name: "ТЕст4", mc_name: "MrYuze", dept: "Высший Совет", bio: "Глава аналитики.", note: "Внешние связи." }
};

let systemStatus = { state: "NORMAL", label: "ШТАТНЫЙ РЕЖИМ", color: "#00ffcc", reason: "" };
const userStates = new Map();

// === API ===
app.post('/login', (req, res) => {
    const { id, pass } = req.body;
    const user = staffDB[id];
    if (user && user.pass === pass) res.json({ success: true, level: user.level, name: user.name, role: user.role });
    else res.status(401).json({ success: false });
});

app.get('/get-admin-staff', (req, res) => res.json(staffDB));
app.get('/get-staff', (req, res) => res.json(playerDB));

app.post('/send-report', (req, res) => {
    const { user, text, timestamp } = req.body;
    const msg = `📩 **НОВЫЙ РАПОРТ**\n━━━━━━━━━━━━━━\n👤 **От:** ${user}\n🕒 **Время:** ${timestamp}\n━━━━━━━━━━━━━━\n📝 **Текст:**\n${text}`;
    bot.telegram.sendMessage(ADMIN_CHAT_ID, msg, { parse_mode: 'Markdown' });
    res.json({ success: true });
});

app.post('/auth-log', (req, res) => {
    const { id, name, level } = req.body;
    bot.telegram.sendMessage(ADMIN_CHAT_ID, `👤 **ВХОД**\nID: \`${id}\`\nИмя: **${name}**\nДопуск: **L${level}**`, { parse_mode: 'Markdown' });
    res.json({ success: true });
});

app.get('/status', (req, res) => res.json(systemStatus));

// === КОМАНДЫ БОТА ===
const mainMenu = Markup.keyboard([
    ['🔴 RED CODE', '🟢 STABLE'],
    ['👥 ДОСЬЕ', '👔 СОТРУДНИКИ'],
    ['📊 ТЕКУЩИЙ СТАТУС', '🧹 ОЧИСТКА']
]).resize();

bot.start(async (ctx) => {
    const msg = await ctx.reply('🛡️ Терминал P.R.I.S.M. активен.', mainMenu);
    trackMsg(ctx, msg);
});

bot.hears('📊 ТЕКУЩИЙ СТАТУС', async (ctx) => {
    let message = `📊 **ТЕКУЩИЙ СТАТУС:**\n\n🔹 Режим: **${systemStatus.label}**\n`;
    if (systemStatus.reason) message += `📝 Причина: _${systemStatus.reason}_`;
    const msg = await ctx.reply(message, { parse_mode: 'Markdown' });
    trackMsg(ctx, msg);
});

// РЕАЛЬНОЕ УДАЛЕНИЕ
bot.hears('🧹 ОЧИСТКА', async (ctx) => {
    const chatID = ctx.chat.id;
    const ids = chatHistory.get(chatID) || [];
    
    // Удаляем сообщение пользователя "🧹 ОЧИСТКА"
    try { await ctx.deleteMessage(ctx.message.message_id); } catch(e) {}

    // Удаляем историю бота
    for (const id of ids) {
        try { await ctx.deleteMessage(id); } catch (e) {}
    }
    
    chatHistory.set(chatID, []); // Сброс истории
    const msg = await ctx.reply('🧹 Терминал очищен.', mainMenu);
    trackMsg(ctx, msg);
});

bot.hears('👥 ДОСЬЕ', async (ctx) => {
    let list = "📂 **РЕЕСТР СУБЪЕКТОВ:**\n\n";
    Object.keys(playerDB).forEach(id => { list += `🔹 \`${id}\` — ${playerDB[id].name} (L${playerDB[id].level})\n`; });
    const msg = await ctx.reply(list, { parse_mode: 'Markdown' });
    trackMsg(ctx, msg);
});

bot.hears('👔 СОТРУДНИКИ', async (ctx) => {
    let list = "🛡️ **РЕЕСТР ДОСТУПА:**\n\n";
    Object.keys(staffDB).forEach(id => { 
        list += `🔸 \`${id}\` — ${staffDB[id].name} (L${staffDB[id].level}, ключ: \`${staffDB[id].pass}\`)\n`; 
    });
    const msg = await ctx.reply(list, { parse_mode: 'Markdown' });
    trackMsg(ctx, msg);
});

bot.hears('🔴 RED CODE', async (ctx) => {
    userStates.set(ctx.from.id, 'WAITING_FOR_REASON');
    const msg = await ctx.reply('🚨 Введите причину:', Markup.removeKeyboard());
    trackMsg(ctx, msg);
});

bot.hears('🟢 STABLE', async (ctx) => {
    systemStatus = { state: "NORMAL", label: "ШТАТНЫЙ РЕЖИМ", color: "#00ffcc", reason: "" };
    const msg = await ctx.reply('✅ Система стабилизирована.', mainMenu);
    trackMsg(ctx, msg);
});

bot.on('text', async (ctx, next) => {
    const state = userStates.get(ctx.from.id);
    if (state === 'WAITING_FOR_REASON') {
        systemStatus = { state: "RED", label: "🚨 КРИТИЧЕСКОЕ СОСТОЯНИЕ", color: "#ff4444", reason: ctx.message.text };
        userStates.delete(ctx.from.id);
        const msg = await ctx.reply(`⚠️ УСТАНОВЛЕН КРАСНЫЙ КОД`, mainMenu);
        trackMsg(ctx, msg);
        bot.telegram.sendMessage(ADMIN_CHAT_ID, `‼️ **ALARM**\nПричина: ${systemStatus.reason}`);
        return;
    }
    return next();
});

bot.launch();
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`API port: ${PORT}`));
