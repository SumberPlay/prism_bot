const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const http = require('http');

// --- НАСТРОЙКИ ---
const token = '7809111631:AAGO30xOzwdfZpuL_5ee5GhClmy_94w3UEI';
const scriptURL = 'AKfycbxwnLBJUWq4m2JgT8gc8mFvnxlQf_klyMAF5W9sCDdyY48dS0BFrpRMAU3v2FLYj3032Q';
const adminID = 5681992508; 

// --- ЗАГЛУШКА ДЛЯ RENDER ---
// Это нужно, чтобы Render видел активный порт и не выключал бота
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('P.R.I.S.M. Bot is Running');
}).listen(process.env.PORT || 3000);

// --- ЛОГИКА БОТА ---
const bot = new TelegramBot(token, {polling: true});

console.log("🚀 Система P.R.I.S.M. запущена...");

bot.onText(/\/status (stable|red)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const status = match[1];

    // Проверка прав доступа
    if (userId !== adminID) {
        bot.sendMessage(chatId, "⛔ ДОСТУП ЗАПРЕЩЕН. ВАШ ID ЗАФИКСИРОВАН.");
        return;
    }

    try {
        // Отправляем сигнал в Google Таблицу
        await axios.get(`${scriptURL}?set=${status}`);
        
        const message = status === 'red' 
            ? "⚠️ ВНИМАНИЕ! ОБЪЯВЛЕН РЕЖИМ КРАСНОЙ УГРОЗЫ!" 
            : "✅ СИТУАЦИЯ СТАБИЛИЗИРОВАНА. РЕЖИМ СТАБИЛЕН.";
            
        bot.sendMessage(chatId, message);
        console.log(`Статус изменен на: ${status}`);
    } catch (error) {
        console.error("Ошибка при связи с таблицей:", error.message);
        bot.sendMessage(chatId, "❌ ОШИБКА СВЯЗИ С ЦЕНТРАЛЬНЫМ СЕРВЕРОМ.");
    }
});

// Обработка ошибок бота (чтобы не падал)
bot.on('polling_error', (error) => {
    console.log("Ошибка Polling:", error.code);
});
