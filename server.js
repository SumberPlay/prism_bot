<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>P.R.I.S.M. | Тактический Терминал</title>
    <style>
        :root { 
            --combat-red: #ff3300; 
            --bg-dark: #050505; 
            --panel-bg: #1a1a1a; 
            --alert-blink: #ff0000;
        }
        body { background: var(--bg-dark); color: #e0e0e0; font-family: 'Courier New', monospace; margin: 0; transition: background 0.3s; }
        
        /* Боевой режим при RED CODE */
        body.combat-alert { background: #1a0000; }
        body.combat-alert .header-combat { background: #ff0000; box-shadow: 0 0 20px rgba(255, 0, 0, 0.5); }
        body.combat-alert .tactical-card { border-color: #ff0000; }

        nav { background: #000; padding: 15px; border-bottom: 2px solid var(--combat-red); text-align: center; }
        nav a { color: #888; text-decoration: none; text-transform: uppercase; padding: 0 20px; font-weight: bold; transition: 0.3s; }
        nav a:hover { color: var(--combat-red); }
        
        .container { max-width: 900px; margin: 40px auto; padding: 0 20px; }
        
        .header-combat { 
            background: var(--combat-red);
            color: #000;
            padding: 10px 20px;
            margin-bottom: 30px;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: 0.3s;
        }
        
        h2 { margin: 0; letter-spacing: 2px; }
        
        .tactical-card { 
            border: 1px solid #333; 
            padding: 20px; 
            margin-bottom: 20px;
            background: linear-gradient(90deg, #111 0%, #1a1a1a 100%);
            transition: 0.3s;
        }

        .tactical-card h3 { 
            color: var(--combat-red); 
            border-bottom: 1px solid var(--combat-red);
            padding-bottom: 5px;
            margin-top: 0;
            text-transform: uppercase;
        }

        .weapon-spec {
            display: grid;
            grid-template-columns: 120px 1fr;
            gap: 10px;
            font-size: 0.9em;
            background: #000;
            padding: 10px;
            margin-top: 10px;
        }

        .label { color: #666; font-weight: bold; text-transform: uppercase; }

        .alert-level {
            padding: 10px 25px;
            border: 2px solid;
            font-weight: bold;
            display: inline-block;
            margin-bottom: 20px;
            letter-spacing: 2px;
        }

        .level-high { border-color: #ff0000; color: #ff0000; animation: blink 1s infinite; }
        .level-normal { border-color: #00ff00; color: #00ff00; }

        @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }

        .back-link { color: var(--combat-red); text-decoration: none; font-weight: bold; display: inline-block; margin-top: 20px; }
        .back-link:hover { text-decoration: underline; }

        #tactical-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            pointer-events: none;
            background: repeating-linear-gradient(0deg, rgba(0,0,0,0.1) 0px, rgba(0,0,0,0.1) 1px, transparent 2px);
            z-index: 100;
        }
    </style>
</head>
<body>

<div id="tactical-overlay"></div>

<nav>
    <a href="index.html">Главная</a>
    <a href="staff.html">Назад в Терминал</a>
    <a href="science.html">НИД</a>
</nav>

<div class="container">
    <div class="header-combat">
        <h2>COMBAT OPERATIONAL SECTOR</h2>
        <span id="sync-val">v.4.0.2-TACTICAL</span>
    </div>

    <div id="status-box" class="alert-level level-normal">СТАТУС: МОНИТОРИНГ</div>

    <div class="tactical-card">
        <h3>Экипировка ВГР "Eternal Sunshine"</h3>
        <p>Стандартный комплект для подавления негуманоидных угроз и охраны объектов P.R.I.S.M.</p>
        
        <div class="weapon-spec">
            <div class="label">Оружие:</div>
            <div>Меч "Radiance", Винтовка AR-15 (P.R.I.S.M. Mod), расходники.</div>
            <div class="label">Броня:</div>
            <div>Тактический комплекс "Titan-N" (Уровень 4).</div>
            <div class="label">Радар:</div>
            <div>Биометрический сканер (подключен к штабу).</div>
        </div>
    </div>

    <div class="tactical-card">
        <h3>Протоколы применения силы</h3>
        <p id="protocol-text">При обнаружении аномалии, проявляющей агрессию:</p>
        <ol id="protocol-list">
            <li>Установить периметр в радиусе 50 метров.</li>
            <li>Применить подавляющий огонь (только по конечностям).</li>
            <li>Дождаться прибытия научной группы.</li>
        </ol>
        <p style="color: var(--combat-red); font-weight: bold; border: 1px solid var(--combat-red); padding: 10px;">
            ВНИМАНИЕ: Ликвидация объекта разрешена только при угрозе прорыва или по приказу О5!
        </p>
    </div>

    <a href="staff.html" class="back-link">&larr; ВЕРНУТЬСЯ К ПАНЕЛИ</a>
</div>

<script>
    const RENDER_API = "https://твой-адрес-на-render.onrender.com"; // ЗАМЕНИ НА СВОЮ

    async function syncTactical() {
        try {
            const res = await fetch(`${RENDER_API}/status`);
            const data = await res.json();
            
            const statusBox = document.getElementById('status-box');
            const body = document.body;
            const pText = document.getElementById('protocol-text');
            const pList = document.getElementById('protocol-list');

            if (data.state === "RED") {
                body.classList.add('combat-alert');
                statusBox.innerText = "СТАТУС: БОЕВАЯ ТРЕВОГА (RED CODE)";
                statusBox.className = "alert-level level-high";
                
                // Изменяем инструкции на более жесткие
                pText.innerHTML = "<span style='color:red'>ВНИМАНИЕ! ОБНАРУЖЕН ПРОРЫВ. ДЕЙСТВУЕТ ПРОТОКОЛ 'ЗАЧИСТКА':</span>";
                pList.innerHTML = `
                    <li>Открыть огонь на поражение без предупреждения.</li>
                    <li>Блокировать все входы и выходы сектора.</li>
                    <li>Ликвидировать любую угрозу целостности комплекса.</li>
                `;
            } else {
                body.classList.remove('combat-alert');
                statusBox.innerText = "СТАТУС: ШТАТНЫЙ МОНИТОРИНГ";
                statusBox.className = "alert-level level-normal";
                
                // Возвращаем стандартные инструкции
                pText.innerText = "При обнаружении аномалии, проявляющей агрессию:";
                pList.innerHTML = `
                    <li>Установить периметр в радиусе 50 метров.</li>
                    <li>Применить подавляющий огонь (только по конечностям).</li>
                    <li>Дождаться прибытия научной группы.</li>
                `;
            }
        } catch (e) {
            document.getElementById('status-box').innerText = "ОШИБКА СВЯЗИ";
        }
    }

    setInterval(syncTactical, 3000);
    syncTactical();
</script>

</body>
</html>
