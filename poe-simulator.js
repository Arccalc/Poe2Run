import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Папка и файл для тестовых логов
const TEST_DIR = path.join(__dirname, 'test_logs');
const CLIENT_TXT = path.join(TEST_DIR, 'Test_Client.txt');

// Создаем папку, если ее нет
if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
}

// Вспомогательная функция: генерация реалистичного времени (PoE формат)
function getPoETimestamp() {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

// Вспомогательная функция: формирование строки лога (PoE 2 формат)
function getLogLine(zoneName) {
    // Формат: 2026/05/22 18:35:48 87566562 7fbd122e [INFO Client 25548] [SCENE] Set Source [ZoneName]
    return `${getPoETimestamp()} 12345678 7fbd122e [INFO Client 99999] [SCENE] Set Source [${zoneName}]\n`;
}

// Вспомогательная функция: пауза
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- СЦЕНАРИИ ТЕСТИРОВАНИЯ ---

const scenarios = {
    1: {
        name: "Идеальный ран (Без заминок)",
        events: [
            { zone: "Clearfell Encampment", delay: 1000, desc: "Вход в город (Подготовка)" },
            { zone: "The Riverbank", delay: 3000, desc: "Боевая зона (Таймер ДОЛЖЕН запуститься!)" },
            { zone: "Clearfell", delay: 5000, desc: "Боевая зона (Сплит 1)" },
            { zone: "Osgoth", delay: 6000, desc: "Город (Таймер города ДОЛЖЕН пойти)" },
            { zone: "Osgoth Tunnels", delay: 4000, desc: "Боевая зона (Таймер города стоп, Сплит 2)" },
            { zone: "The Depths", delay: 5000, desc: "Боевая зона (Сплит 3, Конец рана)" }
        ]
    },
    2: {
        name: "Случайный возврат в город (Стресс-тест)",
        events: [
            { zone: "Clearfell Encampment", delay: 1000, desc: "Вход в город" },
            { zone: "The Riverbank", delay: 2000, desc: "Боевая зона (Старт)" },
            { zone: "Clearfell", delay: 3000, desc: "Боевая зона" },
            { zone: "Clearfell Encampment", delay: 2000, desc: "СЛУЧАЙНЫЙ ПОРТАЛ В ГОРОД (Сплит не должен создаться)" },
            { zone: "Clearfell", delay: 3000, desc: "Возврат в ту же локацию (Сплит не должен создаться)" },
            { zone: "Osgoth Tunnels", delay: 4000, desc: "Новая боевая зона (Создание сплита)" }
        ]
    }
};

async function runScenario(scenarioId) {
    const scenario = scenarios[scenarioId];
    if (!scenario) {
        console.error("❌ Неверный номер сценария.");
        process.exit(1);
    }

    console.log(`\n🚀 Запуск сценария: "${scenario.name}"`);
    console.log(`📂 Пишем логи в: ${CLIENT_TXT}\n`);

    // Очищаем тестовый файл перед началом
    fs.writeFileSync(CLIENT_TXT, "");

    for (const event of scenario.events) {
        console.log(`⏳ Ждем ${(event.delay / 1000).toFixed(1)} сек...`);
        await sleep(event.delay);
        
        const logLine = getLogLine(event.zone);
        fs.appendFileSync(CLIENT_TXT, logLine);
        
        console.log(`✅ [ЛОГ ЗАПИСАН] -> ${event.zone} | ${event.desc}`);
    }

    console.log(`\n🎉 Сценарий завершен! Проверь интерфейс таймера.`);
    process.exit(0);
}

// --- ИНТЕРФЕЙС КОНСОЛИ ---

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log("=== POE 2 SPEEDRUN SIMULATOR ===");
console.log("Доступные сценарии:");
for (const [id, data] of Object.entries(scenarios)) {
    console.log(`[${id}] - ${data.name}`);
}

rl.question('\nВведи номер сценария и нажми Enter: ', (answer) => {
    runScenario(answer.trim());
});