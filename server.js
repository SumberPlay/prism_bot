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

// === БАЗА ДОСТУПА (КТО может зайти на сайт) ===
let staffDB = {
    "M4SK": { 
        pass: "5e03fcd2d70a976a6b026374da5da3f9", 
        role: "scientific", level: 3, name: "МэнсиКейн"
    },
    "KRMP": { 
        pass: "1bf502b835ee007957e558cbb1959ecb", 
        role: "military", level: 2, name: "Кримпи"
    },
    "SUMBR": { 
        pass: "8aaa688aadaf78796f5f620a4897eeb3", 
        role: "council", level: 5, name: "Самбер"
    },
    "MRYZE": { 
        pass: "b0eee0a274f64e6f5792b85c93321159", 
        role: "council", level: 5, name: "Юз"
    }
};

// === БАЗА НАБЛЮДЕНИЯ (ЧТО отображается в Dossier) ===
let playerDB = {
    "M4SK": { 
        role: "scientific", level: 3, name: "ТЕст1", 
        mc_name: "m4skine_", dept: "Научный Департамент", 
        bio: "Ведущий специалист по изучению Объекта #001.",
        note: "Замечена повышенная активность. Рекомендовано наблюдение."
    },
    "KRMP": { 
        role: "military", level: 2, name: "ТЕст2", 
        mc_name: "Krimpi", dept: "Военная Группа", 
        bio: "Командир оперативной группы.",
        note: "Прямое подчинение Совету в случае протокола 'ЗЕРО'."
    },
    "SUMBR": { 
        role: "council", level: 5, name: "ТЕст3", 
        mc_name: "SumberTheCreator", dept: "Высший Совет", 
        bio: "Основатель P.R.I.S.M. Личность засекречена.",
        note: "КЛЮЧ_ДОСТУПА: ВСЕ_СЕКТОРА. Инициирует протоколы очистки."
    },
    "MRYZE": { 
        role: "council", level: 5, name: "ТЕст4", 
        mc_name: "MrYuze", dept: "Высший Совет", 
        bio: "Глава аналитического отдела Совета.",
        note: "КЛЮЧ_ДОСТУПА: ВСЕ_СЕКТОРА. Ответственный за внешние связи."
    }
};

let systemStatus = { state: "NORMAL", label: "ШТАТНЫЙ РЕЖИМ", color: "#00ffcc", reason: "" };
const userStates = new Map();

// === API ДЛЯ САЙТА ===

// 1. ЛОГИН (ПРОВЕРКА ПО staffDB)
app.post('/login', (req, res) => {
    const { id, pass } = req.body;
    const user = staffDB[id];
    if (user && user.pass === pass) {
        res.json({ success: true, level: user.level, name: user.name, role: user.role });
    } else {
        res.status(401).json({ success: false, message: "Отказ в доступе" });
    }
});

// 2. СТАТУС СИСТЕМЫ
app.get('/status', (req, res) => res.json(systemStatus));

// 3. СПИСОК КАРТОЧЕК (БЕРЕМ ИЗ playerDB)
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

// 4. ПОЛУЧЕНИЕ БИО (БЕРЕМ ИЗ playerDB)
app.get('/get-bio/:id', (req, res) => {
    const player = playerDB[req.params.id];
    res.json({ bio: player ? player.bio : "ДАННЫЕ ОТСУТСТВУЮТ" });
});

// 5. ОТПРАВКА РАПОРТА
app.post('/send-report', (req, res) => {
    const { user, text, timestamp } = req.body;
    if (!text) return res.status(400).json({ success: false });

    const reportMsg = `📩 **НОВЫЙ РАПОРТ**\n━━━━━━━━━━━━━━\n👤 **От:** ${user}\n🕒 **Время:** ${timestamp}\n━━━━━━━━━━━━━━\n📝 **Текст:**\n${text}`;
    
    bot.telegram.sendMessage(ADMIN_CHAT_ID, reportMsg, { parse_mode: 'Markdown' })
        .then(() => res.json({ success: true }))
        .catch(() => res.status(500).json({ success: false }));
});

// 6. ЛОГ АВТОРИЗАЦИИ
app.post('/auth-log', (req, res) => {
    const { id, name, level } = req.body;
    const logMsg = `👤 **ВХОД В СИСТЕМУ**\n━━━━━━━━━━━━━━\nID: \`${id}\`\nИмя: **${name}**\nДопуск: **L${level}**\n━━━━━━━━━━━━━━\nСтатус: Сессия активна.`;
    bot.telegram.sendMessage(ADMIN_CHAT_ID, logMsg, { parse_mode: 'Markdown' });
    res.json({ success: true });
});

// === КОМАНДЫ БОТА ===
const mainMenu = Markup.keyboard([
    ['🔴 RED CODE', '🟢 STABLE'],
    ['✍️ СТАТУС', '👥 ОБЪЕКТЫ'],
    ['📊 ТЕКУЩИЙ СТАТУС']
]).resize();

bot.start((ctx) => ctx.reply('🛡️ Терминал управления P.R.I.S.M. активен.', mainMenu));

// Показываем список из playerDB
bot.hears('👥 ОБЪЕКТЫ', (ctx) => {
    let list = "📂 **РЕЕСТР СУБЪЕКТОВ НАБЛЮДЕНИЯ:**\n\n";
    Object.keys(playerDB).forEach(id => { 
        list += `🔹 \`${id}\` — ${playerDB[id].name} (L${playerDB[id].level})\n`; 
    });
    list += "\nДля правки заметки: `/set_note ID текст`";
    ctx.reply(list, { parse_mode: 'Markdown' });
});

bot.command('set_note', (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 3) return ctx.reply('Формат: /set_note ID текст');
    const targetId = args[1].toUpperCase();
    const newNote = args.slice(2).join(' ');
    if (playerDB[targetId]) {
        playerDB[targetId].note = newNote;
        ctx.reply(`✅ Заметка для ${playerDB[targetId].name} обновлена.`);
    } else {
        ctx.reply('❌ ID игрока не найден в базе наблюдения.');
    }
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
