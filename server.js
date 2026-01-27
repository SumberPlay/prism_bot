const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');
const axios = require('axios');

// Инициализация переменных
const BOT_TOKEN = process.env.BOT_TOKEN;
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

// Главная страница (чтобы не было "Cannot GET /")
app.get('/', (req, res) => {
    res.send('<h1>P.R.I.S.M. API CORE</h1><p>Status: ONLINE</p>');
});

// --- ДОБАВИТЬ В index.js ---

// --- ИСПРАВЛЕННЫЕ МАРШРУТЫ ДЛЯ РАБОТЫ С SUPABASE ---

// 1. Добавление задачи в БД
app.post('/add-task', async (req, res) => {
    try {
        const { staff_id, task_text } = req.body;
        const fullUrl = SB_URL.includes('/rest/v1') ? SB_URL : `${SB_URL}/rest/v1`;

        await axios.post(`${fullUrl}/staff_tasks`, {
            staff_id: staff_id,
            task_text: task_text,
            is_done: false
        }, { headers: SB_HEADERS });

        console.log(`[COUNCIL] Директива записана в Supabase для: ${staff_id}`);
        res.status(200).json({ success: true });
    } catch (e) {
        console.error("Ошибка добавления задачи:", e.response?.data || e.message);
        res.status(500).json({ error: "DB Write Error" });
    }
});

// 2. Удаление задачи из БД
app.post('/remove-task', async (req, res) => {
    try {
        const { staff_id, task_text } = req.body;
        const fullUrl = SB_URL.includes('/rest/v1') ? SB_URL : `${SB_URL}/rest/v1`;

        // Удаляем конкретную строку, где совпадает ID и текст
        await axios.delete(`${fullUrl}/staff_tasks?staff_id=eq.${staff_id}&task_text=eq.${task_text}`, 
        { headers: SB_HEADERS });

        res.status(200).json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "DB Delete Error" });
    }
});

// 3. Регистрация нового сотрудника в таблицу staff
app.post('/register-staff', async (req, res) => {
    try {
        const fullUrl = SB_URL.includes('/rest/v1') ? SB_URL : `${SB_URL}/rest/v1`;
        const newStaff = {
            id: req.body.id,
            name: req.body.name,
            mc_name: req.body.mc_name,
            level: parseInt(req.body.level),
            password: Math.random().toString(36).slice(-6), // Генерируем случайный пароль
            dept: "SECURITY",
            note: "НОВЫЙ ОБЪЕКТ"
        };

        await axios.post(`${fullUrl}/staff`, newStaff, { headers: SB_HEADERS });
        
        console.log(`[COUNCIL] Сотрудник ${newStaff.id} внесен в Supabase`);
        res.status(200).json({ success: true });
    } catch (e) {
        console.error("Ошибка регистрации:", e.response?.data || e.message);
        res.status(500).json({ error: "Registration Error" });
    }
});

// 4. Полное удаление сотрудника
app.post('/delete-staff', async (req, res) => {
    try {
        const { staff_id } = req.body;
        const fullUrl = SB_URL.includes('/rest/v1') ? SB_URL : `${SB_URL}/rest/v1`;

        // Сначала удаляем все задачи этого сотрудника (каскадом)
        await axios.delete(`${fullUrl}/staff_tasks?staff_id=eq.${staff_id}`, { headers: SB_HEADERS });
        // Затем удаляем самого сотрудника
        await axios.delete(`${fullUrl}/staff?id=eq.${staff_id}`, { headers: SB_HEADERS });

        res.status(200).json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Termination Error" });
    }
});
// --- API ДЛЯ САЙТА ---
app.post('/login', async (req, res) => {
    try {
        const { id, pass } = req.body;
        const { data } = await sbGet('staff', `id=eq.${id}&password=eq.${pass}`);
        if (data[0]) res.json({ success: true, ...data[0] });
        else res.status(401).json({ success: false });
    } catch (e) { res.status(500).json({ error: "DB Error" }); }
});

// Получение сотрудников вместе с их задачами
app.get('/get-admin-staff', async (req, res) => {
    try {
        // Получаем всех сотрудников
        const { data: staff } = await sbGet('staff', 'order=level.desc');
        // Получаем все задачи
        const { data: tasks } = await sbGet('staff_tasks');

        // Объединяем: добавляем каждому сотруднику массив его задач
        const fullData = staff.map(member => ({
            ...member,
            tasks: tasks
                .filter(t => t.staff_id === member.id)
                .map(t => ({ text: t.task_text, done: t.is_done }))
        }));

        res.json(fullData);
    } catch (e) {
        res.status(500).json([]);
    }
});

// Отметить задачу как выполненную
app.post('/complete-task', async (req, res) => {
    try {
        const { staff_id, task_text } = req.body;
        const fullUrl = SB_URL.includes('/rest/v1') ? SB_URL : `${SB_URL}/rest/v1`;

        // Обновляем статус is_done для конкретной задачи этого сотрудника
        await axios.patch(`${fullUrl}/staff_tasks?staff_id=eq.${staff_id}&task_text=eq.${task_text}`, 
        { is_done: true }, 
        { headers: SB_HEADERS });

        res.json({ success: true });
    } catch (e) {
        console.error("Ошибка обновления задачи:", e);
        res.status(500).json({ success: false });
    }
});

app.get('/get-staff', async (req, res) => {
    try {
        const { data } = await sbGet('players', 'order=display_name.asc');
        res.json(data);
    } catch (e) { res.status(500).json([]); }
});

app.get('/status', (req, res) => res.json(systemStatus));

app.post('/send-report', async (req, res) => {
    try {
        const { user, text, timestamp } = req.body;
        const fullUrl = SB_URL.includes('/rest/v1') ? SB_URL : `${SB_URL}/rest/v1`;

        // 1. Сохраняем в таблицу reports
        await axios.post(`${fullUrl}/reports`, {
            staff_name: user,
            report_text: text,
            created_at: new Date().toISOString()
        }, { headers: SB_HEADERS });

        // 2. Дублируем в Telegram для мгновенного уведомления
        const msg = `📜 **НОВЫЙ РАПОРТ (В БД)**\n👤 ${user}\n⏰ ${timestamp}\n📝 ${text}`;
        await bot.telegram.sendMessage(ADMIN_CHAT_ID, msg, { parse_mode: 'Markdown' });

        res.json({ success: true });
    } catch (e) {
        console.error("Ошибка сохранения рапорта:", e.response ? e.response.data : e.message);
        res.status(500).json({ success: false });
    }
});

// Получение архива для сайта
app.get('/get-archive', async (req, res) => {
    try {
        const { data } = await sbGet('archive', 'order=id.desc');
        res.json(data);
    } catch (e) { 
        console.error("Archive API Error:", e);
        res.status(500).json([]); 
    }
});

// Получение аномалий для сайта
app.get('/get-anomalies', async (req, res) => {
    try {
        const { data } = await sbGet('anomalies', 'order=id.asc');
        res.json(data);
    } catch (e) { 
        console.error("Anomalies API Error:", e);
        res.status(500).json([]); 
    }
});

// --- КОМАНДЫ БОТА ---
const mainMenu = Markup.keyboard([
    ['🔴 RED CODE', '🟢 STABLE'],
    ['📝 СОЗДАТЬ ЗАПИСЬ', '📂 АРХИВ', '📜 НОВАЯ ЗАДАЧА'],
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
bot.hears('🧹 СБРОС ЗАДАЧ', async (ctx) => {
    try {
        const fullUrl = SB_URL.includes('/rest/v1') ? SB_URL : `${SB_URL}/rest/v1`;
        await axios.delete(`${fullUrl}/staff_tasks?is_done=eq.true`, { headers: SB_HEADERS });
        ctx.reply("✅ Все выполненные директивы удалены из архива.");
    } catch (e) { ctx.reply("❌ Ошибка очистки."); }
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
    // ... внутри bot.on('text') ...

    if (state.step === 'TASK_USER') {
        userStates.set(ctx.from.id, { ...state, step: 'TASK_TEXT', targetId: ctx.message.text.toUpperCase() });
        return ctx.reply(`Введите текст директивы для ${ctx.message.text}:`);
    }

    if (state.step === 'TASK_TEXT') {
        try {
            const fullUrl = SB_URL.includes('/rest/v1') ? SB_URL : `${SB_URL}/rest/v1`;
            await axios.post(`${fullUrl}/staff_tasks`, {
                staff_id: state.targetId,
                task_text: ctx.message.text,
                is_done: false
            }, { headers: SB_HEADERS });

            ctx.reply(`✅ Директива для ${state.targetId} внесена в реестр.`, mainMenu);
    } catch (e) {
        ctx.reply("❌ Ошибка. Убедитесь, что ID сотрудника верен.");
    }
    userStates.delete(ctx.from.id);
    return;
}
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
bot.hears('📜 НОВАЯ ЗАДАЧА', (ctx) => {
    userStates.set(ctx.from.id, { step: 'TASK_USER' });
    ctx.reply("Введите ID сотрудника (напр. AGENT_01):", Markup.removeKeyboard());
});
bot.hears('🧹 ОЧИСТКА', async (ctx) => {
    const chatId = ctx.chat.id;
    const lastMsgId = ctx.message.message_id;
    
    ctx.reply("⚠️ Запуск протокола очистки... (удаление последних 100 сообщений)");

    // Цикл удаления: пробуем удалить последние 100 ID сообщений
    let deletedCount = 0;
    for (let i = 0; i < 100; i++) {
        try {
            await ctx.telegram.deleteMessage(chatId, lastMsgId - i);
            deletedCount++;
        } catch (e) {
            // Игнорируем ошибки (если сообщение уже удалено или слишком старое)
            continue;
        }
    }

    // Отправляем уведомление и удаляем его через 5 секунд
    const report = await ctx.reply(`🧹 Очистка завершена. Удалено: ${deletedCount} ед. данных.`);
    setTimeout(() => {
        ctx.telegram.deleteMessage(chatId, report.message_id).catch(() => {});
    }, 5000);
});

bot.catch((err) => {
    console.error('Telegraf error:', err);
});

bot.launch().then(() => console.log("BOT DEPLOYED"));
app.listen(process.env.PORT || 10000, () => console.log("P.R.I.S.M. CORE ONLINE"));










