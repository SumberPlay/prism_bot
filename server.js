const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');
const axios = require('axios');

// Инициализация переменных
const BOT_TOKEN = process.env.BOT_TOKEN || '7809111631:AAGO30xOzwdfZpuL_5ee5GhClmy_94w3UEI';
const ADMIN_CHAT_ID = '5681992508'; 

// Проверка наличия переменных Supabase
const SB_URL = process.env.SUPABASE_URL ? process.env.SUPABASE_URL.replace(/\/$/, "") : null;
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

// --- БЕЗОПАСНЫЙ ГЕТТЕР ---
const sbGet = async (table, params = "") => {
    if (!SB_URL || !SB_KEY) {
        throw new Error("SUPABASE_CONFIG_MISSING");
    }
    // Проверяем, есть ли /rest/v1 в конце URL, если нет - добавляем
    const fullUrl = SB_URL.includes('/rest/v1') ? SB_URL : `${SB_URL}/rest/v1`;
    return axios.get(`${fullUrl}/${table}?${params}`, { headers: SB_HEADERS });
};

// --- API ДЛЯ САЙТА ---
app.post('/login', async (req, res) => {
    try {
        const { id, pass } = req.body;
        const { data } = await sbGet('staff', `id=eq.${id}&password=eq.${pass}`);
        if (data[0]) res.json({ success: true, ...data[0] });
        else res.status(401).json({ success: false });
    } catch (e) { res.status(500).json({ error: "DB Error" }); }
});

app.get('/get-admin-staff', async (req, res) => {
    try {
        const { data } = await sbGet('staff', 'order=level.desc');
        res.json(data);
    } catch (e) { res.status(500).json([]); }
});

app.get('/get-staff', async (req, res) => {
    try {
        const { data } = await sbGet('players', 'order=display_name.asc');
        res.json(data);
    } catch (e) { res.status(500).json([]); }
});

app.get('/status', (req, res) => res.json(systemStatus));

// --- КОМАНДЫ БОТА ---
const mainMenu = Markup.keyboard([
    ['🔴 RED CODE', '🟢 STABLE'],
    ['📝 СОЗДАТЬ ЗАПИСЬ', '📂 АРХИВ'],
    ['👥 ИГРОКИ', '👔 ПЕРСОНАЛ', '⚠️ АНОМАЛИИ'],
    ['📊 СТАТУС', '🧹 ОЧИСТКА']
]).resize();

bot.start((ctx) => ctx.reply('🛡️ P.R.I.S.M. CORE: ONLINE', mainMenu));

// Исправленная кнопка Персонал
bot.hears('👔 ПЕРСОНАЛ', async (ctx) => {
    try {
        const { data } = await sbGet('staff', 'order=level.desc');
        let text = "👔 *СПИСОК СОТРУДНИКОВ:*\n\n";
        data.forEach(u => {
            // Используем обычный Markdown. 
            // В нем нет ||спойлеров||, поэтому для скрытия пароля используем `косую черту` или просто пишем текстом
            text += `🔸 \`${u.id}\` — ${u.name} (L${u.level})\nКлюч: \`${u.password || 'не задан'}\` \n\n`;
        });
        ctx.reply(text, { parse_mode: 'Markdown' }); 
    } catch (e) {
        ctx.reply("❌ Ошибка базы данных.");
    }
});

bot.hears('👥 ИГРОКИ', async (ctx) => {
    try {
        const { data } = await sbGet('players');
        let text = "👥 **АКТИВНЫЕ СУБЪЕКТЫ:**\n\n";
        data.forEach(p => text += `🔹 \`${p.id}\` — ${p.display_name || p.id} (L${p.level}) [${p.rank || 'БЕЗ РАНГА'}]\n`);
        ctx.reply(text, { parse_mode: 'Markdown' });
    } catch (e) { ctx.reply("❌ Ошибка связи с базой игроков."); }
});

bot.hears('⚠️ АНОМАЛИИ', async (ctx) => {
    try {
        const { data } = await sbGet('anomalies', 'order=id.asc');
        let text = "☣️ **РЕЕСТР АНОМАЛИЙ:**\n\n";
        data.forEach(a => text += `📟 \`#${a.id}\` — **${a.code}** [${a.class}]\n`);
        ctx.reply(text, { parse_mode: 'Markdown' });
    } catch (e) { ctx.reply("❌ Ошибка связи с реестром аномалий."); }
});

bot.hears('📂 АРХИВ', async (ctx) => {
    try {
        const { data } = await sbGet('archive', 'order=id.desc&limit=5');
        if (data.length === 0) return ctx.reply("Архив пуст.");
        for (const note of data) {
            await ctx.reply(`📜 **${note.title}** (L${note.level})\n_${note.date}_\n\n${note.content}`, {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([Markup.button.callback('🗑 Удалить', `del_${note.id}`)])
            });
        }
    } catch (e) { ctx.reply('❌ Ошибка доступа к архиву.'); }
});

bot.action(/^del_(.+)$/, async (ctx) => {
    try {
        const fullUrl = SB_URL.includes('/rest/v1') ? SB_URL : `${SB_URL}/rest/v1`;
        await axios.delete(`${fullUrl}/archive?id=eq.${ctx.match[1]}`, { headers: SB_HEADERS });
        await ctx.answerCbQuery("Запись стерта");
        await ctx.editMessageText("🗑 Запись удалена из центральной базы.");
    } catch (e) { ctx.reply('❌ Ошибка удаления.'); }
});

// Логика создания записи
bot.hears('📝 СОЗДАТЬ ЗАПИСЬ', (ctx) => {
    userStates.set(ctx.from.id, { step: 'TITLE' });
    ctx.reply("Введите заголовок записи:", Markup.removeKeyboard());
});

bot.on('text', async (ctx, next) => {
    const state = userStates.get(ctx.from.id);
    if (!state || typeof state === 'string') return next();

    if (state.step === 'TITLE') {
        userStates.set(ctx.from.id, { ...state, step: 'LVL', title: ctx.message.text });
        ctx.reply("Уровень доступа (1-5):");
    } else if (state.step === 'LVL') {
        userStates.set(ctx.from.id, { ...state, step: 'TEXT', lvl: ctx.message.text });
        ctx.reply("Введите текст протокола:");
    } else if (state.step === 'TEXT') {
        try {
            const note = {
                title: state.title,
                level: parseInt(state.lvl) || 1,
                content: ctx.message.text,
                date: new Date().toLocaleDateString('ru-RU')
            };
            const fullUrl = SB_URL.includes('/rest/v1') ? SB_URL : `${SB_URL}/rest/v1`;
            await axios.post(`${fullUrl}/archive`, note, { headers: SB_HEADERS });
            ctx.reply("✅ Запись внесена в реестр.", mainMenu);
        } catch (e) { ctx.reply("❌ Ошибка сохранения.", mainMenu); }
        userStates.delete(ctx.from.id);
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

bot.hears('📊 СТАТУС', (ctx) => {
    ctx.reply(`📊 СТАТУС: ${systemStatus.label}\n${systemStatus.reason ? 'Причина: ' + systemStatus.reason : ''}`);
});

bot.hears('🧹 ОЧИСТКА', (ctx) => {
    ctx.reply("🧹 Команда очистки вызвана. (Функция в разработке для новой БД)", mainMenu);
});

bot.catch((err) => {
    console.error('Telegraf error:', err);
});

bot.launch().then(() => console.log("BOT DEPLOYED"));
app.listen(process.env.PORT || 10000, () => console.log("P.R.I.S.M. CORE ONLINE"));

