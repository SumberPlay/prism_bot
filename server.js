const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');

const BOT_TOKEN = '7809111631:AAGO30xOzwdfZpuL_5ee5GhClmy_94w3UEI';
const ADMIN_CHAT_ID = '5681992508'; 

const app = express();
const bot = new Telegraf(BOT_TOKEN);

app.use(cors());
app.use(express.json());
app.get('/', (req, res) => {
    res.status(200).send('SERVER_HEARTBEAT_OK');
});
// Хранилище ID сообщений для удаления
const chatHistory = new Map();

// Функция для записи ID сообщения
const trackMsg = (ctx, msg) => {
    if (!chatHistory.has(ctx.chat.id)) chatHistory.set(ctx.chat.id, []);
    chatHistory.get(ctx.chat.id).push(msg.message_id);
};

// === БАЗЫ ДАННЫХ ===
let staffDB = {
    "M4SK": { 
        pass: "5e03fcd2d70a976a6b026374da5da3f9", 
        role: "scientific", 
        mc_name: "M4skine_", 
        level: 3, 
        name: "МэнсиКейн", 
        dept: "НАУЧНЫЙ ОТДЕЛ", 
        spec: "АНОМАЛИИ", 
        joined: "03.01.2026", 
        bio: "ИССЛЕДОВАТЕЛЬ", 
        note: "ДОПУСК К СЕКТОРУ B" 
    },
    "KRMP": { 
        pass: "1bf502b835ee007957e558cbb1959ecb", 
        role: "military", 
        mc_name: "Krimpi", 
        level: 2, 
        name: "Кримпи", 
        dept: "ВГР", 
        spec: "ТАКТИКА", 
        joined: "03.01.2026", 
        bio: "ГЛАВА ВГР ES", 
        note: "ПАТРУЛЬ ПЕРИМЕТРА" 
    },
    "SUMBR": { 
        pass: "8aaa688aadaf78796f5f620a4897eeb3", 
        role: "council", 
        mc_name: "SumberTheCreator", 
        level: 5, 
        name: "Самбер", 
        dept: "ВЫСШИЙ СОВЕТ", 
        spec: "КУРАТОР", 
        joined: "С основания", 
        bio: "ОСНОВАТЕЛЬ P.R.I.S.M.", 
        note: "ПОЛНЫЙ ДОСТУП" 
    },
    "MRYZE": { 
        pass: "b0eee0a274f64e6f5792b85c93321159", 
        role: "council", 
        mc_name: "MrYuze", 
        level: 5, 
        name: "Юз", 
        dept: "ВЫСШИЙ СОВЕТ", 
        spec: "СТРАТЕГ", 
        joined: "С основания", 
        bio: "ГЛАВА АНАЛИТИКИ", 
        note: "КУРАТОР ПРОЕКТОВ" 
    },
    "RAY": { 
        pass: "c20b11e4ce0f2d30e2d4d4f4e4089192", 
        role: "council", 
        mc_name: "34ray_", 
        level: 5, 
        name: "Рей", 
        dept: "ВЫСШИЙ СОВЕТ", 
        spec: "КУРАТОР", 
        joined: "Данные отсутствуют", 
        bio: "ЭПШТЕЙН", 
        note: "КУРАТОР ПРОЕКТОВ" 
    },
    "MRS": { 
        pass: "ff88883a61ea14ec248d3739c52aee16", 
        role: "scientific", 
        mc_name: "MorisReal", 
        level: 4, 
        name: "Морис", 
        dept: "НАУЧНЫЙ ОТДЕЛ", 
        spec: "ГЛАВА ОНГ", 
        joined: "25.01.2026", 
        bio: "ГЛАВА ОНГ", 
        note: "КУРАТОР ОНГ" 
    }
};

let playerDB = {
    "M4SK": { level: 0, name: "ТЕст1", mc_name: "Steve", dept: "Организация1", bio: "Создатель." },
    "KRMP": { level: 2, name: "ТЕст2", mc_name: "Steve1", dept: "Организация2", bio: "Отдель снабжения.", note: "Подчинение Совету." },
    "SUMBR": { level: 3, name: "ТЕст3", mc_name: "Steve2", dept: "Организация3", bio: "Не придумал." },
    "MRYZE": { level: 5, name: "ТЕст4", mc_name: "Steve3", dept: "Организация4", bio: "Глава глав." }
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
app.get('/get-staff', (req, res) => {
    const safeDB = {};
    for (let id in playerDB) {
        safeDB[id] = { 
            name: playerDB[id].name, 
            level: playerDB[id].level, 
            dept: playerDB[id].dept, 
            mc_name: playerDB[id].mc_name, 
            role: playerDB[id].role,
            bio: playerDB[id].bio,   // Убедись, что эта строка есть
            note: playerDB[id].note  // И эта тоже
        };
    }
    res.json(safeDB);
});

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
    ['📝 СОЗДАТЬ ЗАПИСЬ', '📂 АРХИВ'],
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
// Старт процесса
bot.hears('📝 СОЗДАТЬ ЗАПИСЬ', async (ctx) => {
    if (ctx.chat.id.toString() !== ADMIN_CHAT_ID) return;
    userStates.set(ctx.from.id, { step: 'WAIT_TITLE' });
    await ctx.reply('📄 ВВЕДИТЕ ЗАГОЛОВОК ЗАПИСИ:', Markup.removeKeyboard());
});

// Обработка шагов
bot.on('text', async (ctx, next) => {
    const state = userStates.get(ctx.from.id);
    if (!state) return next();

    // 1. ЛОГИКА RED CODE (КРАТКИЙ СТЕЙТ)
    if (state === 'WAITING_FOR_REASON') {
        systemStatus = { state: "RED", label: "🚨 КРИТИЧЕСКОЕ СОСТОЯНИЕ", color: "#ff4444", reason: ctx.message.text };
        userStates.delete(ctx.from.id);
        const msg = await ctx.reply(`⚠️ УСТАНОВЛЕН КРАСНЫЙ КОД`, mainMenu);
        trackMsg(ctx, msg);
        bot.telegram.sendMessage(ADMIN_CHAT_ID, `‼️ **ALARM**\nПричина: ${systemStatus.reason}`);
        return;
    }

    // 2. ЛОГИКА СОЗДАНИЯ ЗАПИСИ (ПОШАГОВЫЙ ОБЪЕКТ)
    if (state.step === 'WAIT_TITLE') {
        userStates.set(ctx.from.id, { step: 'WAIT_LEVEL', title: ctx.message.text });
        await ctx.reply('🔑 УСТАНОВИТЕ УРОВЕНЬ ДОСТУПА (1-5):');
        
    } else if (state.step === 'WAIT_LEVEL') {
        const lvl = parseInt(ctx.message.text);
        if (isNaN(lvl) || lvl < 1 || lvl > 5) return ctx.reply("Введите число от 1 до 5!");
        
        userStates.set(ctx.from.id, { ...state, step: 'WAIT_CONTENT', level: lvl });
        await ctx.reply('✍️ ВВЕДИТЕ ТЕКСТ ЗАПИСИ:');

    } else if (state.step === 'WAIT_CONTENT') {
        const finalNote = {
            id: `L${Date.now()}`,
            title: state.title,
            level: state.level,
            content: ctx.message.text,
            date: new Date().toLocaleDateString('ru-RU')
        };

        await ctx.reply('⏳ Сохранение в базу P.R.I.S.M...');
        const success = await addNoteToArchive(finalNote);
        
        userStates.delete(ctx.from.id);
        await ctx.reply(success ? '✅ ЗАПИСЬ УСПЕШНО ДОБАВЛЕНА' : '❌ ОШИБКА ГИТХАБА', mainMenu);
    }
});
async function addNoteToArchive(newNote) {
    const url = `https://api.github.com/repos/${process.env.GITHUB_REPO}/contents/${FILE_PATH}?t=${Date.now()}`;
    const headers = { Authorization: `token ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' };

    try {
        const res = await axios.get(url, { headers });
        const sha = res.data.sha;
        // Декодируем текущий архив или создаем пустой массив, если файл пуст
        let content = JSON.parse(Buffer.from(res.data.content, 'base64').toString() || "[]");
        
        content.push(newNote); // Добавляем новую запись

        await axios.put(url, {
            message: `New entry: ${newNote.title}`,
            content: Buffer.from(JSON.stringify(content, null, 4)).toString('base64'),
            sha: sha
        }, { headers });
        return true;
    } catch (e) {
        console.error("GH_ERROR:", e.response?.data || e.message);
        return false;
    }
}
bot.launch();
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`API port: ${PORT}`));








