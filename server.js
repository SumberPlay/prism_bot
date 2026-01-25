const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');

// Данные из ваших настроек
const BOT_TOKEN = '7809111631:AAGO30xOzwdfZpuL_5ee5GhClmy_94w3UEI';
const ADMIN_CHAT_ID = '5681992508'; 

const app = express();
const bot = new Telegraf(BOT_TOKEN);

app.use(cors());
app.use(express.json());

// Объект статуса с поддержкой причины
let systemStatus = {
    state: "NORMAL",
    label: "ШТАТНЫЙ РЕЖИМ",
    color: "#00ffcc",
    reason: ""
};

// Хранилище временных состояний пользователей
const userStates = new Map();

// === API ===
app.get('/', (req, res) => {
    res.send('🛡️ P.R.I.S.M. API IS ACTIVE');
});

app.get('/status', (req, res) => {
    res.json(systemStatus);
});

app.post('/send-report', (req, res) => {
    const { user, subject, text, timestamp } = req.body;
    const reportMsg = `📩 **НОВЫЙ РАПОРТ**\n━━━━━━━━━━━━━━\n👤 **От:** ${user}\n📝 **Тема:** ${subject}\n🕒 **Время:** ${timestamp}\n━━━━━━━━━━━━━━\n${text}`;
    bot.telegram.sendMessage(ADMIN_CHAT_ID, reportMsg, { parse_mode: 'Markdown' });
    res.json({ success: true });
});

// === КЛАВИАТУРА ===
const mainMenu = Markup.keyboard([
    ['🔴 RED CODE', '🟢 STABLE'],
    ['✍️ ИЗМЕНИТЬ СТАТУС', '🧹 ОЧИСТКА'],
    ['📊 ТЕКУЩИЙ СТАТУС']
]).resize();

// === ЛОГИКА БОТА ===

bot.start((ctx) => ctx.reply('🛡️ Терминал управления P.R.I.S.M. активирован.', mainMenu));

// Активация Красного Кода (Запрос причины)
bot.hears('🔴 RED CODE', (ctx) => {
    userStates.set(ctx.from.id, 'WAITING_FOR_REASON');
    ctx.reply('🚨 ВНИМАНИЕ! Введите причину активации КРАСНОГО КОДА:', Markup.removeKeyboard());
});

// Стабилизация (Сброс статуса)
bot.hears('🟢 STABLE', (ctx) => {
    systemStatus = { 
        state: "NORMAL", 
        label: "ШТАТНЫЙ РЕЖИМ", 
        color: "#00ffcc", 
        reason: "" 
    };
    userStates.delete(ctx.from.id);
    ctx.reply('✅ Ситуация стабилизирована. Система возвращена в штатный режим.', mainMenu);
});

bot.hears('📊 ТЕКУЩИЙ СТАТУС', (ctx) => {
    let message = `📊 **Текущий статус:** ${systemStatus.label}\n`;
    if (systemStatus.reason) message += `📝 **Причина:** ${systemStatus.reason}`;
    ctx.reply(message, { parse_mode: 'Markdown' });
});

// Ручное изменение текста статуса
bot.command('set_status', (ctx) => {
    const newLabel = ctx.message.text.split('/set_status ')[1];
    if (!newLabel) return ctx.reply('Использование: /set_status Текст');
    systemStatus.label = newLabel.toUpperCase();
    ctx.reply(`✅ Заголовок статуса изменен на: ${systemStatus.label}`);
});

bot.hears('✍️ ИЗМЕНИТЬ СТАТУС', (ctx) => {
    ctx.reply('Чтобы просто изменить текст без смены режима, введите: /set_status ВАШ ТЕКСТ');
});

// Очистка чата
bot.hears('🧹 ОЧИСТКА', async (ctx) => {
    ctx.reply('Зачистка последних сообщений...');
    for (let i = 0; i < 20; i++) {
        try { await ctx.deleteMessage(ctx.message.message_id - i).catch(() => {}); } catch (e) {}
    }
});

// ОБРАБОТЧИК ТЕКСТА (Для ввода причины и прочего)
bot.on('text', async (ctx, next) => {
    const userId = ctx.from.id;
    const state = userStates.get(userId);

    if (state === 'WAITING_FOR_REASON') {
        const reasonText = ctx.message.text;

        // Обновляем глобальный статус
        systemStatus = {
            state: "RED",
            label: "🚨 КРИТИЧЕСКОЕ СОСТОЯНИЕ",
            color: "#ff4444",
            reason: reasonText
        };

        userStates.delete(userId); // Очищаем состояние

        await ctx.reply(`⚠️ RED CODE УСТАНОВЛЕН\nПричина: ${reasonText}`, mainMenu);

        // Уведомление администратору
        const alertMsg = `‼️ **ALARM: RED CODE**\n━━━━━━━━━━━━━━\n👤 **Инициатор:** ${ctx.from.first_name}\n🔴 **Причина:** ${reasonText}`;
        bot.telegram.sendMessage(ADMIN_CHAT_ID, alertMsg, { parse_mode: 'Markdown' });
        return;
    }

    return next();
});

// Запуск
bot.launch().then(() => console.log('Bot is running...'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
