const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const cors = require('cors');

// === НАСТРОЙКИ ===
const BOT_TOKEN = '7809111631:AAGO30xOzwdfZpuL_5ee5GhClmy_94w3UEI';
const ADMIN_CHAT_ID = '5681992508'; // ID для получения рапортов и логов

const app = express();
const bot = new Telegraf(BOT_TOKEN);

app.use(cors());
app.use(express.json());

// === СОСТОЯНИЕ СИСТЕМЫ ===
let systemStatus = {
    state: "NORMAL",
    label: "ШТАТНЫЙ РЕЖИМ",
    color: "#00ffcc"
};

// === API ДЛЯ САЙТА ===

// Получение статуса для индикаторов на сайте
app.get('/status', (req, res) => {
    res.json(systemStatus);
});

// Прием рапортов с сайта
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

// 1. Красный уровень
bot.hears('🔴 RED CODE', (ctx) => {
    systemStatus = { state: "RED", label: "🚨 КРИТИЧЕСКОЕ СОСТОЯНИЕ", color: "#ff4444" };
    ctx.reply('⚠️ ВНИМАНИЕ: Объявлен КРАСНЫЙ УРОВЕНЬ! Все системы переведены в режим боевой готовности.');
    bot.telegram.sendMessage(ADMIN_CHAT_ID, "‼️ ВНИМАНИЕ: Смена режима системы на RED CODE пользователем " + ctx.from.first_name);
});

// 2. Стабилизация
bot.hears('🟢 STABLE', (ctx) => {
    systemStatus = { state: "NORMAL", label: "ШТАТНЫЙ РЕЖИМ", color: "#00ffcc" };
    ctx.reply('✅ Ситуация стабилизирована. Система возвращена в штатный режим.');
});

// 3. Кастомный статус
bot.hears('✍️ ИЗМЕНИТЬ СТАТУС', (ctx) => {
    ctx.reply('Введите новый текст статуса командой: /set_status ТЕКСТ');
});

bot.command('set_status', (ctx) => {
    const newLabel = ctx.message.text.split('/set_status ')[1];
    if (!newLabel) return ctx.reply('Использование: /set_status Текст вашего статуса');
    
    systemStatus.label = newLabel.toUpperCase();
    ctx.reply(`✅ Статус обновлен на: ${systemStatus.label}`);
});

// 4. Удаление чата (очистка мусора)
bot.hears('🧹 ОЧИСТКА', async (ctx) => {
    ctx.reply('Начинаю протокол зачистки последних 50 сообщений...');
    for (let i = 0; i < 50; i++) {
        try {
            await ctx.deleteMessage(ctx.message.message_id - i).catch(() => {});
        } catch (e) {}
    }
});

// Инфо
bot.hears('📊 ТЕКУЩИЙ СТАТУС', (ctx) => {
    ctx.reply(`Состояние: ${systemStatus.state}\nТекст: ${systemStatus.label}`);
});

bot.launch();

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
