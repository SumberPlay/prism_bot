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
// Эндпоинт для удаления рапорта из базы данных

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
// Эндпоинт для получения всех рапортов из таблицы reports
// Исправленный эндпоинт получения рапортов
app.get('/get-reports', async (req, res) => {
    try {
        // Используем твою функцию sbGet, которую ты уже написал
        const { data } = await sbGet('reports', 'order=id.desc');
        res.json(data);
    } catch (err) {
        console.error("Ошибка при получении рапортов:", err.message);
        res.status(500).json({ error: "DATABASE_CONNECTION_ERROR" });
    }
});

// Исправленный эндпоинт удаления рапорта
app.post('/delete-report', async (req, res) => {
    const { report_id } = req.body;
    if (!report_id) return res.status(400).json({ error: "REPORT_ID_MISSING" });

    try {
        // Удаляем через axios, используя URL и заголовки Supabase
        await axios.delete(`${getFullSbUrl()}/reports?id=eq.${report_id}`, { 
            headers: SB_HEADERS 
        });

        console.log(`[SYSTEM] Report #${report_id} deleted.`);
        res.json({ success: true });
    } catch (err) {
        console.error("Database Error:", err.response?.data || err.message);
        res.status(500).json({ error: "DATABASE_DELETE_FAILED" });
    }
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
// Эндпоинт для списка аномалий
app.get('/get-anomalies', async (req, res) => {
    const userLvl = parseInt(req.headers['x-access-level']) || 0;
    const { data } = await sbGet('anomalies', 'order=id.asc'); // Твоя функция запроса к Supabase

    const safeData = data.map(obj => {
        if (userLvl < obj.lvl) {
            return {
                id: obj.id,
                lvl: obj.lvl,
                code: "CLASSIFIED",
                class: "critical",
                proc: "[ДАННЫЕ УДАЛЕНЫ]",
                desc: "ДОСТУП ЗАПРЕЩЕН",
                is_restricted: true
            };
        }
        return { ...obj, is_restricted: false };
    });
    res.json(safeData);
});

// Эндпоинт для досье игроков (модуль ЛИЧНЫЕ ДЕЛА)
app.post('/complete-task', async (req, res) => {
    try {
        const { staff_id, task_text } = req.body;
        const fullUrl = getFullSbUrl(); // Используем функцию для получения URL

        // ВАЖНО: используем encodeURIComponent для task_text, так как там есть пробелы!
        const query = `staff_id=eq.${staff_id}&task_text=eq.${encodeURIComponent(task_text)}`;
        
        await axios.patch(`${fullUrl}/staff_tasks?${query}`, 
            { is_done: true }, 
            { headers: SB_HEADERS }
        );

        console.log(`[SYSTEM] Задача "${task_text}" отмечена как выполненная для ${staff_id}`);
        res.json({ success: true });
    } catch (e) {
        console.error("Ошибка обновления задачи:", e.response?.data || e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

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
// Эндпоинт для ARCHIVE_EXPLORER (тянет данные из таблицы игроков)
app.get('/get-staff', async (req, res) => {
    try {
        // 1. Получаем уровень доступа из заголовка (по умолчанию 1, если гость)
        const userLevel = parseInt(req.headers['x-access-level']) || 1;
        
        // 2. Тянем всех игроков
        const { data } = await sbGet('players', 'order=level.asc');
        
        if (!data) return res.json([]);

        // 3. ФИЛЬТРАЦИЯ ДАННЫХ
        const safeData = data.map(member => {
            const memberLevel = parseInt(member.level) || 1;

            // Если уровень сотрудника выше уровня того, кто смотрит
            if (userLevel < memberLevel) {
                return {
                    id: member.id,
                    level: memberLevel,
                    // Заменяем данные на заглушки прямо на сервере
                    name: "CLASSIFIED",
                    mc_name: "Steve", // Чтобы аватарка сменилась на Стива
                    dept: "REDACTED",
                    bio: "ACCESS_DENIED: НЕДОСТАТОЧНЫЙ УРОВЕНЬ ДОПУСКА.",
                    isLocked: true // Пометка для фронтенда
                };
            }
            // Если уровень позволяет — отдаем полные данные
            return { ...member, isLocked: false };
        });

        console.log(`[SYSTEM] Запрос досье. Уровень доступа: ${userLevel}`);
        res.json(safeData);
    } catch (e) {
        console.error("❌ Ошибка загрузки:", e.message);
        res.status(500).json({ error: "DB_FETCH_FAILED" });
    }
});
app.get('/get-archive', async (req, res) => {
    try {
        // Получаем уровень допуска из заголовков запроса
        const userLevel = parseInt(req.headers['x-access-level']) || 1;
        
        // Запрашиваем у Supabase только те записи, уровень которых <= уровню пользователя
        // Используем фильтр .lte (Less Than or Equal)
        const { data } = await sbGet('archive', `level=lte.${userLevel}&order=id.desc`);
        
        res.json(data);
    } catch (e) { 
        console.error(e);
        res.status(500).json([]); 
    }
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

    // Логика создания записи в архив
    if (state.step === 'TITLE') {
        userStates.set(ctx.from.id, { ...state, step: 'LVL', title: ctx.message.text });
        return ctx.reply("Укажите уровень секретности (1-5):");
    } 
    
    else if (state.step === 'LVL') {
        const level = parseInt(ctx.message.text);
        if (isNaN(level) || level < 1 || level > 5) return ctx.reply("Ошибка. Введите число от 1 до 5:");
        
        userStates.set(ctx.from.id, { ...state, step: 'TEXT', lvl: level });
        return ctx.reply("Введите основной текст протокола:");
    } 
    
    else if (state.step === 'TEXT') {
        try {
            const newEntry = {
                title: state.title,
                level: state.lvl,
                content: ctx.message.text,
                date: new Date().toLocaleDateString('ru-RU')
            };

            await axios.post(`${getFullSbUrl()}/archive`, newEntry, { headers: SB_HEADERS });
            
            ctx.reply("✅ ПРОТОКОЛ УСПЕШНО ВНЕСЕН В РЕЕСТР", mainMenu);
        } catch (e) {
            console.error("Save Error:", e.response?.data || e.message);
            ctx.reply("❌ ОШИБКА ЗАПИСИ: Проверьте структуру таблицы 'archive'", mainMenu);
        }
        userStates.delete(ctx.from.id); // Сбрасываем состояние
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
        let text = "<b>👔 СПИСОК СОТРУДНИКОВ:</b>\n\n";
        
        data.forEach(u => {
            // Экранируем возможные скобки в именах, чтобы HTML не "съел" их
            const name = u.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const id = u.id.toUpperCase();
            
            text += `🔸 <code>${id}</code> — ${name} (L${u.level})\n`;
            // Используем официальный тег спойлера для HTML
            text += `Ключ: <tg-spoiler>${u.password}</tg-spoiler>\n\n`;
        });

        await ctx.reply(text, { parse_mode: 'HTML' });
    } catch (e) {
        console.error("Ошибка вывода персонала:", e);
        ctx.reply("❌ Ошибка доступа к базе данных.");
    }
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
// --- ОБРАБОТКА КНОПКИ АРХИВ ---
bot.hears('📂 АРХИВ', async (ctx) => {
    try {
        const { data } = await sbGet('archive', 'order=id.desc&limit=10');
        
        if (!data || data.length === 0) {
            return ctx.reply("🗄 Реестр пуст. База данных не содержит записей.");
        }

        let report = "<b>📂 ПОСЛЕДНИЕ ПРОТОКОЛЫ АРХИВА:</b>\n\n";
        data.forEach(item => {
            report += `<b>🆔 ID: ${item.id}</b> | 🔐 L${item.level || 1}\n`;
            report += `📍 <b>${item.title}</b>\n`;
            report += `📝 <code>${item.content ? item.content.substring(0, 150) : 'Нет текста'}...</code>\n`;
            report += `────────────────────\n`;
        });

        await ctx.reply(report, { parse_mode: 'HTML' });
    } catch (e) {
        console.error("Архив Error:", e.message);
        ctx.reply("❌ СБОЙ ПОДКЛЮЧЕНИЯ К ЦЕНТРАЛЬНОМУ АРХИВУ");
    }
});

// --- ОБРАБОТКА КНОПКИ АНОМАЛИИ ---
bot.hears('⚠️ АНОМАЛИИ', async (ctx) => {
    try {
        const { data } = await sbGet('anomalies', 'order=id.asc');
        if (!data || data.length === 0) return ctx.reply("🛡️ Аномалий не зафиксировано.");

        let message = "<b>⚠️ РЕЕСТР АНОМАЛЬНЫХ ОБЪЕКТОВ:</b>\n\n";
        data.forEach(obj => {
            message += `<b>[ ${obj.index_number || obj.id} ]</b> — ${obj.name}\n`;
            message += `Класс: <code>${obj.class || 'Не указан'}</code>\n`;
            message += `Статус: ${obj.status || 'Наблюдение'}\n\n`;
        });

        await ctx.reply(message, { parse_mode: 'HTML' });
    } catch (e) {
        ctx.reply("❌ Ошибка базы аномалий.");
    }
});

// --- ОБРАБОТКА КНОПКИ ИГРОКИ (Личные дела) ---
bot.hears('👥 ИГРОКИ', async (ctx) => {
    try {
        const { data } = await sbGet('players', 'order=level.desc');
        if (!data || data.length === 0) return ctx.reply("👥 Список игроков пуст.");

        let text = "<b>👥 РЕЕСТР ГРАЖДАН (ИГРОКИ):</b>\n\n";
        data.forEach(p => {
            text += `🔹 ${p.name} (L${p.level})\n`;
            text += `Ник: <code>${p.mc_name || '---'}</code>\n\n`;
        });
        await ctx.reply(text, { parse_mode: 'HTML' });
    } catch (e) {
        ctx.reply("❌ Ошибка загрузки списка игроков.");
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














