const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios'); // установи через npm install axios

const token = '7809111631:AAGO30xOzwdfZpuL_5ee5GhClmy_94w3UEI';
const scriptURL = 'https://script.google.com/macros/s/AKfycbxwnLBJUWq4m2JgT8gc8mFvnxlQf_klyMAF5W9sCDdyY48dS0BFrpRMAU3v2FLYj3032Q/exec'; // Ссылка из Google Apps Script
const bot = new TelegramBot(token, {polling: true});

const adminID = 5681992508; // Твой ID

bot.onText(/\/status (stable|red)/, async (msg, match) => {
    if (msg.from.id !== adminID) return;
    
    const status = match[1];
    try {
        await axios.get(`${scriptURL}?set=${status}`);
        bot.sendMessage(msg.chat.id, `📡 Система обновлена. Текущий режим: ${status.toUpperCase()}`);
    } catch (e) {
        bot.sendMessage(msg.chat.id, "❌ Ошибка связи с таблицей");
    }
});