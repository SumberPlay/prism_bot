const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');

const BOT_TOKEN = '7809111631:AAGO30xOzwdfZpuL_5ee5GhClmy_94w3UEI';
const ADMIN_CHAT_ID = '5681992508'; 

const app = express();
const bot = new Telegraf(BOT_TOKEN);

app.use(cors());
app.use(express.json());

let systemStatus = {
    state: "NORMAL",
    label: "ШТАТНЫЙ РЕЖИМ",
    color: "#00ffcc"
};

// === ИСПРАВЛЕНИЕ "CANNOT GET /" ===
app.get('/', (req, res) => {
    res.send('🛡️ P.R.I.S.M. API IS ACTIVE');
});

// === API ДЛЯ САЙТА ===
app.get('/status', (req, res) => {
    res.json(systemStatus);
});

app.post('/send-report', (req, res) => {
    const { user, subject, text, timestamp } = req.body;
    const reportMsg = `📩 **НОВЫЙ РАПОРТ**\n━━━━━━━━━━━━━━\n👤 **От:** ${user}\n📝 **Тема:** ${subject}\n🕒 **Время:** ${timestamp}\n━━━━━━━━━━━━━━\n${text}`;
    bot.telegram.sendMessage(ADMIN_CHAT_ID, reportMsg, { parse_mode: 'Markdown' });
    res.json({ success: true });
});

// === ЛОГИКА ТЕЛЕГРАМ-БОТА ===
const mainMenu = Markup.keyboard([
    ['🔴 RED CODE', '🟢 STABLE'],
    ['✍️ ИЗМЕНИТЬ СТАТУС', '🧹 ОЧИСТКА'],
    ['📊 ТЕКУЩИЙ СТАТУС']
]).resize();

bot.start((ctx) => ctx.reply('🛡️ Терминал управления P.R.I.S.M. активирован.', mainMenu));

bot.hears('🔴 RED CODE', (ctx) => {
    systemStatus = { state: "RED", label: "🚨 КРИТИЧЕСКОЕ СОСТОЯНИЕ", color: "#ff4444" };
    ctx.reply('⚠️ Объявлен КРАСНЫЙ УРОВЕНЬ!');
    bot.telegram.sendMessage(ADMIN_CHAT_ID, "‼️ RED CODE активирован пользователем " + ctx.from.first_name);
});

bot.hears('🟢 STABLE', (ctx) => {
    systemStatus = { state: "NORMAL", label: "ШТАТНЫЙ РЕЖИМ", color: "#00ffcc" };
    ctx.reply('✅ Ситуация стабилизирована.');
});

bot.hears('✍️ ИЗМЕНИТЬ СТАТУС', (ctx) => {
    ctx.reply('Введите: /set_status ТЕКСТ');
});

bot.command('set_status', (ctx) => {
    const newLabel = ctx.message.text.split('/set_status ')[1];
    if (!newLabel) return ctx.reply('Использование: /set_status Текст');
    systemStatus.label = newLabel.toUpperCase();
    ctx.reply(`✅ Статус обновлен на: ${systemStatus.label}`);
});

bot.hears('🧹 ОЧИСТКА', async (ctx) => {
    ctx.reply('Зачистка чата...');
    for (let i = 0; i < 50; i++) {
        try { await ctx.deleteMessage(ctx.message.message_id - i).catch(() => {}); } catch (e) {}
    }
});

bot.hears('📊 ТЕКУЩИЙ СТАТУС', (ctx) => {
    ctx.reply(`Состояние: ${systemStatus.state}\nТекст: ${systemStatus.label}`);
});

// === ИСПРАВЛЕНИЕ ОШИБКИ 409 (CONFLICT) ===
bot.launch().then(() => {
    console.log('Bot is running...');
});

// Обработка завершения процесса для Render
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
