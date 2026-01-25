const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');
const axios = require('axios'); // Добавь это в package.json

const BOT_TOKEN = '7809111631:AAGO30xOzwdfZpuL_5ee5GhClmy_94w3UEI';
const ADMIN_CHAT_ID = '5681992508'; 
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Токен из переменных окружения
const GITHUB_REPO = process.env.GITHUB_REPO;   // Например 'M4skine/prism-site'
const FILE_PATH = 'data/archive.json';         // Путь к файлу в репозитории

const app = express();
const bot = new Telegraf(BOT_TOKEN);

app.use(cors());
app.use(express.json());

// === ФУНКЦИЯ РАБОТЫ С GITHUB ===
async function addNoteToGithub(note) {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE_PATH}`;
    const headers = { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' };

    try {
        // 1. Получаем текущий файл
        const res = await axios.get(url, { headers });
        const sha = res.data.sha;
        const content = JSON.parse(Buffer.from(res.data.content, 'base64').toString());

        // 2. Добавляем новую запись
        content.push(note);

        // 3. Отправляем обратно
        const updatedContent = Buffer.from(JSON.stringify(content, null, 4)).toString('base64');
        await axios.put(url, {
            message: `Archive Update: ${note.title}`,
            content: updatedContent,
            sha: sha
        }, { headers });

        return true;
    } catch (e) {
        console.error('GH_ERROR:', e.response ? e.response.data : e.message);
        return false;
    }
}

// === API ЭНДПОИНТЫ ===
app.get('/get-archive', async (req, res) => {
    // Чтобы сайт мог тянуть архив напрямую через твой сервер
    const url = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/${FILE_PATH}`;
    try {
        const response = await axios.get(url);
        res.json(response.data);
    } catch (e) { res.status(500).send('ERR_FETCH_ARCHIVE'); }
});

// ... (твой старый код /login, /get-staff и т.д. остается без изменений) ...

// === КОМАНДЫ БОТА ===
const mainMenu = Markup.keyboard([
    ['🔴 RED CODE', '🟢 STABLE'],
    ['👥 ДОСЬЕ', '👔 СОТРУДНИКИ'],
    ['📝 НОВАЯ ЗАПИСЬ', '📊 ТЕКУЩИЙ СТАТУС'], // Добавили кнопку
    ['🧹 ОЧИСТКА']
]).resize();

bot.hears('📝 НОВАЯ ЗАПИСЬ', async (ctx) => {
    if (ctx.chat.id.toString() !== ADMIN_CHAT_ID) return ctx.reply('ДОСТУП ЗАПРЕЩЕН');
    userStates.set(ctx.from.id, 'WAITING_NOTE_TITLE');
    await ctx.reply('Введите ЗАГОЛОВОК записки:', Markup.removeKeyboard());
});

// Доработка обработчика текста для записок
bot.on('text', async (ctx, next) => {
    const state = userStates.get(ctx.from.id);
    const userId = ctx.from.id;

    if (state === 'WAITING_FOR_REASON') {
        systemStatus = { state: "RED", label: "🚨 КРИТИЧЕСКОЕ СОСТОЯНИЕ", color: "#ff4444", reason: ctx.message.text };
        userStates.delete(userId);
        await ctx.reply(`⚠️ УСТАНОВЛЕН КРАСНЫЙ КОД`, mainMenu);
        bot.telegram.sendMessage(ADMIN_CHAT_ID, `‼️ **ALARM**\nПричина: ${systemStatus.reason}`);
    } 
    else if (state === 'WAITING_NOTE_TITLE') {
        userStates.set(userId, { step: 'WAITING_NOTE_LEVEL', title: ctx.message.text });
        await ctx.reply('Введите УРОВЕНЬ ДОСТУПА (1-5):');
    }
    else if (typeof state === 'object' && state.step === 'WAITING_NOTE_LEVEL') {
        const lvl = parseInt(ctx.message.text);
        if (isNaN(lvl) || lvl < 1 || lvl > 5) return ctx.reply('Введите число от 1 до 5!');
        userStates.set(userId, { ...state, step: 'WAITING_NOTE_TEXT', level: lvl });
        await ctx.reply('Введите ТЕКСТ записки:');
    }
    else if (typeof state === 'object' && state.step === 'WAITING_NOTE_TEXT') {
        const note = {
            id: `LOG_${Date.now()}`,
            title: state.title,
            level: state.level,
            content: ctx.message.text,
            date: new Date().toLocaleDateString('ru-RU')
        };
        
        await ctx.reply('💾 Синхронизация с GitHub...');
        const success = await addNoteToGithub(note);
        
        userStates.delete(userId);
        if (success) await ctx.reply('✅ ЗАПИСЬ СОХРАНЕНА В АРХИВ', mainMenu);
        else await ctx.reply('❌ ОШИБКА ПРИ ЗАПИСИ', mainMenu);
    }
    else return next();
});

bot.launch();
app.listen(process.env.PORT || 10000);
