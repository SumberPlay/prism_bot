const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');
const axios = require('axios');

const BOT_TOKEN = process.env.BOT_TOKEN || '7809111631:AAGO30xOzwdfZpuL_5ee5GhClmy_94w3UEI';
const ADMIN_CHAT_ID = '5681992508'; 
const SB_URL = process.env.SUPABASE_URL; 
const SB_KEY = process.env.SUPABASE_KEY;

const SB_HEADERS = { 
    "apikey": SB_KEY, 
    "Authorization": `Bearer ${SB_KEY}`,
    "Content-Type": "application/json"
};

const app = express();
const bot = new Telegraf(BOT_TOKEN);

app.use(cors());
app.use(express.json());

const userStates = new Map();
let systemStatus = { state: "NORMAL", label: "ШТАТНЫЙ РЕЖИМ", color: "#00ffcc", reason: "" };

// --- ВСПОМОГАТЕЛЬНЫЙ ФЕТЧ ---
const sbGet = (table, params = "") => axios.get(`${SB_URL}/${table}?${params}`, { headers: SB_HEADERS });

// --- API ДЛЯ ТЕРМИНАЛА (САЙТА) ---
app.post('/login', async (req, res) => {
    try {
        const { id, pass } = req.body;
        const { data } = await sbGet('staff', `id=eq.${id}&password=eq.${pass}`);
        if (data[0]) res.json({ success: true, ...data[0] });
        else res.status(401).json({ success: false });
    } catch (e) { res.status(500).json({ error: "DB Error" }); }
});

app.get('/get-admin-staff', async (req, res) => {
    const { data } = await sbGet('staff', 'order=level.desc');
    res.json(data);
});

app.get('/get-staff', async (req, res) => {
    const { data } = await sbGet('players', 'order=display_name.asc');
    res.json(data);
});

app.get('/status', (req, res) => res.json(systemStatus));

// --- КОМАНДЫ БОТА ---
const mainMenu = Markup.keyboard([
    ['🔴 RED CODE', '🟢 STABLE'],
    ['📝 СОЗДАТЬ ЗАПИСЬ', '📂 АРХИВ'],
    ['👥 ИГРОКИ', '👔 ПЕРСОНАЛ', '⚠️ АНОМАЛИИ'],
    ['📊 СТАТУС', '🧹 ОЧИСТКА']
]).resize();

bot.start((ctx) => ctx.reply('🛡️ P.R.I.S.M. CORE: CONNECTED', mainMenu));

// Реестр персонала
bot.hears('👔 ПЕРСОНАЛ', async (ctx) => {
    const { data } = await sbGet('staff', 'order=level.desc');
    let text = "👔 **СПИСОК СОТРУДНИКОВ:**\n\n";
    data.forEach(u => text += `🔸 \`${u.id}\` — ${u.name} (L${u.level})\nКлюч: ||${u.password}||\n\n`);
    ctx.reply(text, { parse_mode: 'MarkdownV2' }); // Скрытый текст для паролей
});

// Реестр игроков
bot.hears('👥 ИГРОКИ', async (ctx) => {
    const { data } = await sbGet('players');
    let text = "👥 **АКТИВНЫЕ СУБЪЕКТЫ:**\n\n";
    data.forEach(p => text += `🔹 \`${p.id}\` — ${p.display_name} (L${p.level}) [${p.rank}]\n`);
    ctx.reply(text, { parse_mode: 'Markdown' });
});

// Реестр аномалий
bot.hears('⚠️ АНОМАЛИИ', async (ctx) => {
    const { data } = await sbGet('anomalies', 'order=id.asc');
    let text = "☣️ **РЕЕСТР АНОМАЛИЙ:**\n\n";
    data.forEach(a => text += `📟 \`#${a.id}\` — **${a.code}** [${a.class}]\n`);
    ctx.reply(text, { parse_mode: 'Markdown' });
});

// Архив (с кнопкой удаления)
bot.hears('📂 АРХИВ', async (ctx) => {
    const { data } = await sbGet('archive', 'order=id.desc&limit=5');
    if (data.length === 0) return ctx.reply("Архив пуст.");
    for (const note of data) {
        await ctx.reply(`📜 **${note.title}** (L${note.level})\n_${note.date}_\n\n${note.content}`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([Markup.button.callback('🗑 Удалить', `del_${note.id}`)])
        });
    }
});

// Обработка удаления
bot.action(/^del_(.+)$/, async (ctx) => {
    await axios.delete(`${SB_URL}/archive?id=eq.${ctx.match[1]}`, { headers: SB_HEADERS });
    await ctx.answerCbQuery("Запись стерта");
    await ctx.editMessageText("🗑 Запись удалена из центральной базы.");
});

// Создание записи в архив (Пошагово)
bot.hears('📝 СОЗДАТЬ ЗАПИСЬ', (ctx) => {
    userStates.set(ctx.from.id, { step: 'TITLE' });
    ctx.reply("Введите заголовок записи:", Markup.removeKeyboard());
});

bot.on('text', async (ctx, next) => {
    const state = userStates.get(ctx.from.id);
    if (!state || typeof state === 'string') return next(); // Пропускаем если это статус

    if (state.step === 'TITLE') {
        userStates.set(ctx.from.id, { ...state, step: 'LVL', title: ctx.message.text });
        ctx.reply("Уровень доступа (1-5):");
    } else if (state.step === 'LVL') {
        userStates.set(ctx.from.id, { ...state, step: 'TEXT', lvl: ctx.message.text });
        ctx.reply("Введите текст протокола:");
    } else if (state.step === 'TEXT') {
        const note = {
            title: state.title,
            level: parseInt(state.lvl),
            content: ctx.message.text,
            date: new Date().toLocaleDateString('ru-RU')
        };
        await axios.post(`${SB_URL}/archive`, note, { headers: SB_HEADERS });
        userStates.delete(ctx.from.id);
        ctx.reply("✅ Запись внесена в реестр.", mainMenu);
    }
});

// Статус системы
bot.hears('🔴 RED CODE', (ctx) => {
    userStates.set(ctx.from.id, 'WAIT_RED');
    ctx.reply("ПРИЧИНА ТРЕВОГИ:", Markup.removeKeyboard());
});

bot.on('text', async (ctx, next) => {
    if (userStates.get(ctx.from.id) !== 'WAIT_RED') return next();
    systemStatus = { state: "RED", label: "🚨 КРИТИЧЕСКОЕ СОСТОЯНИЕ", color: "#ff4444", reason: ctx.message.text };
    userStates.delete(ctx.from.id);
    ctx.reply("⚠️ ТРЕВОГА ОБЪЯВЛЕНА", mainMenu);
});

bot.hears('🟢 STABLE', (ctx) => {
    systemStatus = { state: "NORMAL", label: "ШТАТНЫЙ РЕЖИМ", color: "#00ffcc", reason: "" };
    ctx.reply("✅ Система стабилизирована.", mainMenu);
});

bot.launch();
app.listen(process.env.PORT || 10000, () => console.log("CORE ONLINE"));
