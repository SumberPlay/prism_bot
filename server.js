const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');
const axios = require('axios');

// === КОНФИГУРАЦИЯ ===
const BOT_TOKEN = '7809111631:AAGO30xOzwdfZpuL_5ee5GhClmy_94w3UEI';
const ADMIN_CHAT_ID = '5681992508'; 
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; 
const GITHUB_REPO = process.env.GITHUB_REPO;   
const FILE_PATH = 'data/archive.json';

const app = express();
const bot = new Telegraf(BOT_TOKEN);

app.use(cors());
app.use(express.json());

// === СОСТОЯНИЯ И БАЗЫ ===
const userStates = new Map();
const chatHistory = new Map();

let systemStatus = { state: "NORMAL", label: "ШТАТНЫЙ РЕЖИМ", color: "#00ffcc", reason: "" };

let staffDB = {
    "SUMBR": { pass: "8aaa688aadaf78796f5f620a4897eeb3", level: 5, name: "Самбер", role: "council" },
    "MRYZE": { pass: "b0eee0a274f64e6f5792b85c93321159", level: 5, name: "Юз", role: "council" },
    "RAY": { pass: "c20b11e4ce0f2d30e2d4d4f4e4089192", level: 5, name: "Рей", role: "council" },
    "MRS": { pass: "ff88883a61ea14ec248d3739c52aee16", level: 4, name: "Морис", role: "scientific" },
    "M4SK": { pass: "5e03fcd2d70a976a6b026374da5da3f9", level: 3, name: "МэнсиКейн", role: "scientific" },
    "KRMP": { pass: "1bf502b835ee007957e558cbb1959ecb", level: 2, name: "Кримпи", role: "military" }
};

let playerDB = {
    "M4SK": { level: 3, name: "МэнсиКейн", mc_name: "M4skine_", dept: "НАУЧНЫЙ ОТДЕЛ", bio: "Исследователь аномалий." },
    "KRMP": { level: 2, name: "Кримпи", mc_name: "Krimpi", dept: "ВГР", bio: "Глава ВГР ES." },
    "SUMBR": { level: 5, name: "Самбер", mc_name: "SumberTheCreator", dept: "ВЫСШИЙ СОВЕТ", bio: "Основатель P.R.I.S.M." }
};

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
async function addNoteToGithub(note) {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE_PATH}?t=${Date.now()}`;
    const headers = { 
        Authorization: `token ${GITHUB_TOKEN}`, 
        Accept: 'application/vnd.github.v3+json'
    };

    try {
        const res = await axios.get(url, { headers });
        const currentSha = res.data.sha; 
        const rawContent = Buffer.from(res.data.content, 'base64').toString();
        let archiveArray = JSON.parse(rawContent || "[]");
        
        if (!Array.isArray(archiveArray)) archiveArray = [];
        archiveArray.push(note);

        await axios.put(`https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE_PATH}`, {
            message: `New Report: ${note.title}`,
            content: Buffer.from(JSON.stringify(archiveArray, null, 4)).toString('base64'),
            sha: currentSha
        }, { headers });

        return true;
    } catch (e) {
        console.error("GH_SYNC_ERROR:", e.message);
        return false;
    }
}

// === API ЭНДПОИНТЫ (ДЛЯ САЙТА) ===
app.get('/', (req, res) => res.send('SERVER_HEARTBEAT_OK'));

app.post('/login', (req, res) => {
    const { id, pass } = req.body;
    const user = staffDB[id];
    if (user && user.pass === pass) res.json({ success: true, level: user.level, name: user.name, role: user.role });
    else res.status(401).json({ success: false });
});

app.get('/status', (req, res) => res.json(systemStatus));

// ВОТ ЭТОГО НЕ ХВАТАЛО ДЛЯ РАПОРТОВ:
app.post('/send-report', async (req, res) => {
    const { user, text, timestamp } = req.body;
    if (!text) return res.status(400).send("No text");

    const note = {
        id: `W${Date.now()}`,
        title: `ВЕБ-РАПОРТ ОТ ${user}`,
        level: 1,
        content: text,
        date: timestamp || new Date().toLocaleString('ru-RU')
    };

    const success = await addNoteToGithub(note);
    if (success) {
        bot.telegram.sendMessage(ADMIN_CHAT_ID, `📝 **НОВЫЙ ВЕБ-РАПОРТ**\nОт: ${user}\n\n${text}`, { parse_mode: 'Markdown' });
        res.json({ success: true });
    } else {
        res.status(500).json({ success: false });
    }
});

// ЛОГИ ВХОДА С САЙТА:
app.post('/auth-log', (req, res) => {
    const { id, name, level } = req.body;
    bot.telegram.sendMessage(ADMIN_CHAT_ID, `🔐 **ВХОД В ТЕРМИНАЛ**\nСубъект: ${name} (${id})\nУровень: L${level}`);
    res.json({ success: true });
});

// === ТЕЛЕГРАМ БОТ (ЛОГИКА) ===
const mainMenu = Markup.keyboard([
    ['🔴 RED CODE', '🟢 STABLE'],
    ['📝 НОВАЯ ЗАПИСЬ', '📂 АРХИВ'],
    ['👥 ДОСЬЕ', '👔 СОТРУДНИКИ'],
    ['📊 СТАТУС', '🧹 ОЧИСТКА']
]).resize();

bot.start((ctx) => ctx.reply('🛡️ Терминал P.R.I.S.M. активен.', mainMenu));

// ... (остальные hears: ДОСЬЕ, СОТРУДНИКИ, СТАТУС, АРХИВ - оставляем как были) ...
// (обязательно оставь hears('📝 НОВАЯ ЗАПИСЬ') и bot.on('text') для бота)

// КОРРЕКТНЫЙ ЗАПУСК И ЗАВЕРШЕНИЕ
bot.launch().then(() => console.log("БОТ ЗАПУЩЕН")).catch(err => console.error("LAUNCH_ERROR:", err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`PRISM_SERVER_READY_PORT_${PORT}`));
