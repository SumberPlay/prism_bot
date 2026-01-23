const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const http = require('http');

// --- НАСТРОЙКИ ---
const token = '7809111631:AAGO30xOzwdfZpuL_5ee5GhClmy_94w3UEI';
const scriptURL = 'https://script.google.com/macros/s/AKfycbzR_tCULoFYleId9emJZ0FAw47s1256n-7Zht0vYmVEyZty7nzds077zFMDLvaiTzV-/exec';
const adminID = 5681992508; 

// --- ЗАГЛУШКА ДЛЯ RENDER ---
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('P.R.I.S.M. Bot is Running');
}).listen(process.env.PORT || 3000);

// --- ЛОГИКА БОТА ---
const bot = new TelegramBot(token, {polling: true});

console.log("🚀 Система P.R.I.S.M. запущена...");

// Функция для вызова меню
const sendMenu = (chatId) => {
    bot.sendMessage(chatId, "🛰️ Панель управления P.R.I.S.M. активна:", {
        reply_markup: {
            keyboard: [
                ['🟢 СТАБИЛИЗИРОВАТЬ', '🔴 КРИТИЧЕСКИЙ РЕЖИМ'],
                ['📊 Проверить систему']
            ],
            resize_keyboard: true
        }
    });
};

// Команда /start
bot.onText(/\/start/, (msg) => {
    if (msg.from.id !== adminID) return bot.sendMessage(msg.chat.id, "⛔ ДОСТУП ЗАПРЕЩЕН.");
    sendMenu(msg.chat.id);
});

// Старая логика команд через текст (на всякий случай оставляем)
bot.onText(/\/status (stable|red)/, async (msg, match) => {
    if (msg.from.id !== adminID) return;
    await changeStatus(msg.chat.id, match[1]);
});

// Новая логика через кнопки
bot.on('message', async (msg) => {
    if (msg.from.id !== adminID) return;
    if (!msg.text) return;

    if (msg.text === '🟢 СТАБИЛИЗИРОВАТЬ') {
        await changeStatus(msg.chat.id, 'stable');
    } 
    else if (msg.text === '🔴 КРИТИЧЕСКИЙ РЕЖИМ') {
        await changeStatus(msg.chat.id, 'red');
    }
    else if (msg.text === '📊 Проверить систему') {
        bot.sendMessage(msg.chat.id, "🔍 Мониторинг активен. Проверьте визуализацию на сайте.");
    }
});

// Общая функция для смены статуса
async function changeStatus(chatId, status) {
    try {
        await axios.get(`${scriptURL}?set=${status}`);
        const message = status === 'red' 
            ? "⚠️ ВНИМАНИЕ! ОБЪЯВЛЕН РЕЖИМ КРАСНОЙ УГРОЗЫ!" 
            : "✅ СИТУАЦИЯ СТАБИЛИЗИРОВАНА. РЕЖИМ СТАБИЛЕН.";
        bot.sendMessage(chatId, message);
        console.log(`Статус изменен на: ${status}`);
    } catch (error) {
        console.error("Ошибка связи:", error.message);
        bot.sendMessage(chatId, "❌ ОШИБКА СВЯЗИ С СЕРВЕРОМ.");
    }
}

// Обработка ошибок
bot.on('polling_error', (error) => {
    if (error.code === 'ETELEGRAM' && error.response.body.error_code === 409) {
        console.log("⚠️ Конфликт Polling. Ожидайте перезапуска Render...");
    } else {
        console.log("Ошибка Polling:", error.code);
    }
});


