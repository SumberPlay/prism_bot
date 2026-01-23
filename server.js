const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const http = require('http');

// --- НАСТРОЙКИ ---
const token = '7809111631:AAGO30xOzwdfZpuL_5ee5GhClmy_94w3UEI';
const scriptURL = 'https://script.google.com/macros/s/AKfycbyus0-Ji2zZY9QRsnX1P2iuANunJbBntS7FOVWimM_ZHf0po7GNajCC44zpeiRMMfpu9g/exec';
const adminID = 5681992508; 

// --- ЗАГЛУШКА ДЛЯ RENDER ---
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('P.R.I.S.M. Control Hub is Online');
}).listen(process.env.PORT || 3000);

const bot = new TelegramBot(token, {polling: true});
console.log("🚀 Центр управления P.R.I.S.M. запущен...");

// Функция главного меню
const sendMenu = (chatId) => {
    bot.sendMessage(chatId, "🛠️ ПАНЕЛЬ УПРАВЛЕНИЯ СТАТУСАМИ:", {
        reply_markup: {
            keyboard: [
                ['🟢 СТАБИЛЬНО', '🔴 КРИТИЧЕСКИЙ'],
                ['📊 ТЕКУЩЕЕ СОСТОЯНИЕ']
            ],
            resize_keyboard: true
        }
    });
};
bot.onText(/\/clear/, async (msg) => {
    if (msg.from.id !== adminID) return;

    const chatId = msg.chat.id;
    const lastMsgId = msg.message_id;

    bot.sendMessage(chatId, "🧹 *Запущена зачистка терминала...*", { parse_mode: "Markdown" })
        .then(async (sentMsg) => {
            // Удаляем последние 100 сообщений
            for (let i = 0; i < 100; i++) {
                try {
                    await bot.deleteMessage(chatId, lastMsgId - i);
                } catch (e) {
                    // Игнорируем ошибки (если сообщение уже удалено или слишком старое)
                }
            }
            
            // Удаляем само сообщение о зачистке через 2 секунды
            setTimeout(() => {
                bot.deleteMessage(chatId, sentMsg.message_id).catch(() => {});
            }, 2000);
        });
});
bot.onText(/\/start/, (msg) => {
    if (msg.from.id !== adminID) return;
    sendMenu(msg.chat.id);
});

// ГИБКАЯ КОМАНДА: /warn [цвет] [текст]
// Цвета: yellow, blue, purple
bot.onText(/\/warn (yellow|blue|purple) (.+)/, async (msg, match) => {
    if (msg.from.id !== adminID) return;
    const colorType = match[1];
    const text = match[2];
    
    // Маппинг цветов для таблицы
    const colors = {
        yellow: '#ffd700',
        blue: '#00d9ff',
        purple: '#bb00ff'
    };

    try {
        const encodedText = encodeURIComponent(text.toUpperCase());
        const colorHex = encodeURIComponent(colors[colorType]);
        await axios.get(`${scriptURL}?set=custom&text=${encodedText}&color=${colorHex}`);
        bot.sendMessage(msg.chat.id, `📡 Трансляция запущена: [${colorType.toUpperCase()}] ${text}`);
    } catch (e) {
        bot.sendMessage(msg.chat.id, "❌ Ошибка передачи данных.");
    }
});

// Обработка кнопок и команд статуса
bot.on('message', async (msg) => {
    if (msg.from.id !== adminID || !msg.text) return;

    if (msg.text === '🟢 СТАБИЛЬНО' || msg.text === '/status stable') {
        await changeStatus(msg.chat.id, 'stable');
    } 
    else if (msg.text === '🔴 КРИТИЧЕСКИЙ' || msg.text === '/status red') {
        await changeStatus(msg.chat.id, 'red');
    }
    else if (msg.text === '📊 ТЕКУЩЕЕ СОСТОЯНИЕ') {
        bot.sendMessage(msg.chat.id, "🔍 Система активна. Все терминалы синхронизированы.");
    }
});

async function changeStatus(chatId, status) {
    try {
        await axios.get(`${scriptURL}?set=${status}`);
        const msg = status === 'red' ? "⚠️ РЕЖИМ КРАСНОЙ УГРОЗЫ АКТИВИРОВАН!" : "✅ СИСТЕМА ПЕРЕВЕДЕНА В ШТАТНЫЙ РЕЖИМ.";
        bot.sendMessage(chatId, msg);
    } catch (e) {
        bot.sendMessage(chatId, "❌ ОШИБКА СВЯЗИ.");
    }
}

bot.on('polling_error', (err) => console.log("Polling Error:", err.code));




