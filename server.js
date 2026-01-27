const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');
const axios = require('axios');

// --- ИНИЦИАЛИЗАЦИЯ ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = '5681992508'; 

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

// Состояния пользователей и статус системы
const userStates = new Map();
let systemStatus = { state: "NORMAL", label: "ШТАТНЫЙ РЕЖИМ", color: "#00ffcc", reason: "" };

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
const sbGet = async (table, params = "") => {
    if (!SB_URL || !SB_KEY) throw new Error("SUPABASE_CONFIG_MISSING");
    const fullUrl = SB_URL.includes('/rest/v1') ? SB_URL : `${SB_URL}/rest/v1`;
    return axios.get(`${fullUrl}/${table}?${params}`, { headers: SB_HEADERS });
};

const getFullSbUrl = () => SB_URL.includes('/rest/v1') ? SB_URL : `${SB_URL}/rest/v1`;

// --- API МАРШРУТЫ (ДЛЯ САЙТА) ---

app.get('/', (req, res) => res.send('<h1>P.R.I.S.M. API CORE</h1><p>Status: ONLINE</p>'));

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
        const { data: staff } = await sbGet('staff', 'order=level.desc');
        const { data: tasks } = await sbGet('staff_tasks');
        const fullData = staff.map(member => ({
            ...member,
            tasks: tasks
                .filter(t => t.staff_id === member.id)
                .map(t => ({ text: t.task_text, done: t.is_done })) // Приводим к формату фронтенда
        }));
        res.json(fullData);
    } catch (e) { res.status(500).json([]); }
});

app.post('/register-staff', async (req, res) => {
    try {
        const { id, name, mc_name, level, dept } = req.body;
        const check = await sbGet('staff', `id=eq.${id}`);
        if (check.data && check.data.length > 0) return res.status(400).json({ error: "ID_ALREADY_EXISTS" });

        const newStaff = {
            id: id.toUpperCase(),
            name: name,
            mc_name: mc_name,
            level: parseInt(level),
            password: Math.random().toString(36).slice(-6),
            dept: dept || null, // ТЕПЕРЬ ОБЯЗАТЕЛЬНОСТЬ СНЯТА
            note: "REGISTERED_VIA_COUNCIL"
        };

        await axios.post(`${getFullSbUrl()}/staff`, newStaff, { headers: SB_HEADERS });
        res.status(200).json({ success: true, password: newStaff.password });
    } catch (e) { res.status(500).json({ error: "Registration failed" }); }
});

app.post('/add-task', async (req, res) => {
    try {
        const { staff_id, task_text } = req.body;
        await axios.post(`${getFullSbUrl()}/staff_tasks`, {
            staff_id, task_text, is_done: false
        }, { headers: SB_HEADERS });
        res.status(200).json({ success: true });
    } catch (e) { res.status(500).json({ error: "DB Write Error" }); }
});

app.delete('/remove-task', async (req, res) => {
    try {
        const { staff_id, task_text } = req.query;
        await axios.delete(`${getFullSbUrl()}/staff_tasks?staff_id=eq.${staff_id}&task_text=eq.${encodeURIComponent(task_text)}`, { headers: SB_HEADERS });
        res.status(200).json({ success: true });
    } catch (e) { res.status(500).json({ error: "DB Delete Error" }); }
});

app.post('/delete-staff', async (req, res) => {
    try {
        const { staff_id } = req.body;
        await axios.delete(`${getFullSbUrl()}/staff_tasks?staff_id=eq.${staff_id}`, { headers: SB_HEADERS });
        await axios.delete(`${getFullSbUrl()}/staff?id=eq.${staff_id}`, { headers: SB_HEADERS });
        res.status(200).json({ success: true });
    } catch (e) { res.status(500).json({ error: "Termination failed" }); }
});

app.get('/status', (req, res) => res.json(systemStatus));

app.post('/send-report', async (req, res) => {
    try {
        const { user, text, timestamp } = req.body;
        await axios.post(`${getFullSbUrl()}/reports`, {
            staff_name: user, report_text: text, created_at: new Date().toISOString()
        }, { headers: SB_HEADERS });
        
        const msg = `📜 **НОВЫЙ РАПОРТ**\n👤 ${user}\n⏰ ${timestamp}\n📝 ${text}`;
        await bot.telegram.sendMessage(ADMIN_CHAT_ID, msg, { parse_mode: 'Markdown' });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.get('/get-archive', async (req, res) => {
    try {
        const { data } = await sbGet('archive', 'order=id.desc');
        res.json(data);
    } catch (e) { res.status(500).json([]); }
});

// --- ЛОГИКА ТЕЛЕГРАМ-БОТА ---

const mainMenu = Markup.keyboard([
    ['🔴 RED CODE', '🟢 STABLE'],
    ['📝 СОЗДАТЬ ЗАПИСЬ', '📂 АРХИВ', '📜 НОВАЯ ЗАДАЧА'],
    ['👥 ИГРОКИ', '👔 ПЕРСОНАЛ', '⚠️ АНОМАЛИИ'],
    ['📊 СТАТУС', '🧹 ОЧИСТКА']
]).resize();

bot.start((ctx) => ctx.reply('🛡️ P.R.I.S.M. CORE: ONLINE', mainMenu));

// Объединенный обработчик текстового ввода (САМАЯ ВАЖНАЯ ЧАСТЬ)
bot.on('text', async (ctx, next) => {
    const state = userStates.get(ctx.from.id);
    if (!state) return next();

    // 1. Режим тревоги
    if (state === 'WAIT_RED') {
        systemStatus = { state: "RED", label: "🚨 КРИТИЧЕСКОЕ СОСТОЯНИЕ", color: "#ff4444", reason: ctx.message.text };
        userStates.delete(ctx.from.id);
        return ctx.reply("⚠️ ТРЕВОГА ОБЪЯВЛЕНА", mainMenu);
    }

    // 2. Пошаговые формы (объекты)
    if (typeof state === 'object') {
        // Создание записи в архив
        if (state.step === 'TITLE') {
            userStates.set(ctx.from.id, { ...state, step: 'LVL', title: ctx.message.text });
            return ctx.reply("Уровень доступа (1-5):");
        } else if (state.step === 'LVL') {
            userStates.set(ctx.from.id, { ...state, step: 'TEXT', lvl: ctx.message.text });
            return ctx.reply("Введите текст протокола:");
        } else if (state.step === 'TEXT') {
            try {
                await axios.post(`${getFullSbUrl()}/archive`, {
                    title: state.title,
                    level: parseInt(state.lvl) || 1,
                    content: ctx.message.text,
                    date: new Date().toLocaleDateString('ru-RU')
                }, { headers: SB_HEADERS });
                ctx.reply("✅ Запись внесена в реестр.", mainMenu);
            } catch (e) { ctx.reply("❌ Ошибка записи."); }
            userStates.delete(ctx.from.id);
        }
        // Создание задачи сотруднику
        else if (state.step === 'TASK_USER') {
            userStates.set(ctx.from.id, { ...state, step: 'TASK_TEXT', targetId: ctx.message.text.toUpperCase() });
            return ctx.reply(`Введите текст директивы для ${ctx.message.text}:`);
        } else if (state.step === 'TASK_TEXT') {
            try {
                await axios.post(`${getFullSbUrl()}/staff_tasks`, {
                    staff_id: state.targetId,
                    task_text: ctx.message.text,
                    is_done: false
                }, { headers: SB_HEADERS });
                ctx.reply(`✅ Директива для ${state.targetId} внесена.`, mainMenu);
            } catch (e) { ctx.reply("❌ Ошибка. Проверьте ID."); }
            userStates.delete(ctx.from.id);
        }
    }
});

// Кнопки меню
bot.hears('🔴 RED CODE', (ctx) => {
    userStates.set(ctx.from.id, 'WAIT_RED');
    ctx.reply("ПРИЧИНА ТРЕВОГИ:", Markup.removeKeyboard());
});

bot.hears('🟢 STABLE', (ctx) => {
    systemStatus = { state: "NORMAL", label: "ШТАТНЫЙ РЕЖИМ", color: "#00ffcc", reason: "" };
    ctx.reply("✅ Система стабилизирована.", mainMenu);
});

bot.hears('👔 ПЕРСОНАЛ', async (ctx) => {
    try {
        const { data } = await sbGet('staff', 'order=level.desc');
        let text = "👔 *СПИСОК СОТРУДНИКОВ:*\n\n";
        data.forEach(u => text += `🔸 \`${u.id}\` — ${u.name} (L${u.level})\nКлюч: ||${u.password}||\n\n`);
        ctx.reply(text, { parse_mode: 'Markdown' });
    } catch (e) { ctx.reply("❌ Ошибка БД."); }
});

bot.hears('📊 СТАТУС', (ctx) => {
    ctx.reply(`📊 СТАТУС: ${systemStatus.label}\n${systemStatus.reason ? 'Причина: ' + systemStatus.reason : ''}`);
});

bot.hears('📝 СОЗДАТЬ ЗАПИСЬ', (ctx) => {
    userStates.set(ctx.from.id, { step: 'TITLE' });
    ctx.reply("Введите заголовок записи:", Markup.removeKeyboard());
});

bot.hears('📜 НОВАЯ ЗАДАЧА', (ctx) => {
    userStates.set(ctx.from.id, { step: 'TASK_USER' });
    ctx.reply("Введите ID сотрудника:", Markup.removeKeyboard());
});

bot.hears('🧹 ОЧИСТКА', async (ctx) => {
    const lastId = ctx.message.message_id;
    ctx.reply("⚠️ Очистка последних данных...");
    for (let i = 0; i < 50; i++) {
        try { await ctx.telegram.deleteMessage(ctx.chat.id, lastId - i); } catch (e) {}
    }
});

bot.action(/^del_(.+)$/, async (ctx) => {
    try {
        await axios.delete(`${getFullSbUrl()}/archive?id=eq.${ctx.match[1]}`, { headers: SB_HEADERS });
        await ctx.editMessageText("🗑 Запись удалена.");
    } catch (e) { ctx.reply('❌ Ошибка.'); }
});

// --- ЗАПУСК ---
bot.launch().then(() => console.log("BOT DEPLOYED"));
app.listen(process.env.PORT || 10000, () => console.log("P.R.I.S.M. CORE ONLINE"));
