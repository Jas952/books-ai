# AI Agent — Руководство по интеграции

Эта папка предназначена для модуля ИИ-агента, который будет обрабатывать запросы пользователя по выделенному тексту из PDF-книг.

## Текущее состояние

Сейчас в `Sidebar.jsx` ИИ-ответы эмулируются через `setTimeout`. Заглушка в `agent.js` экспортирует интерфейс `sendMessage()`, который Sidebar должен вызывать вместо мок-логики.

## Три подхода к интеграции

---

### 1. API Key (самый простой старт)

**Суть**: Прямой вызов Gemini API с API-ключом.

**Плюсы**:
- Минимум кода (один HTTP-запрос)
- Не требует авторизации пользователя
- Работает сразу после получения ключа

**Минусы**:
- API-ключ нужно хранить безопасно (не в коде!)
- Расходы привязаны к твоему ключу

**Реализация**:
```javascript
// src/ai/agent.js
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

export async function sendMessage(message, context, apiKey) {
  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: `Контекст из книги:\n${context}\n\nВопрос: ${message}` }
        ]
      }]
    })
  });
  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}
```

**Где хранить ключ**: В Electron можно использовать `electron-store` или системный keychain. Никогда не хардкодить в исходниках.

---

### 2. OAuth (Google Sign-In)

**Суть**: Пользователь авторизуется через Google, и API-вызовы идут от его имени.

**Плюсы**:
- Расходы на стороне пользователя
- Более безопасно (нет общего ключа)
- Можно привязать к Google Workspace

**Минусы**:
- Сложнее в реализации (OAuth flow в Electron)
- Требует настройки Google Cloud Console проекта
- Нужно обрабатывать refresh-токены

**Реализация (шаги)**:
1. Создать проект в Google Cloud Console
2. Настроить OAuth 2.0 credentials (Desktop app)
3. В Electron открыть `BrowserWindow` с OAuth URL
4. Перехватить redirect с authorization code
5. Обменять code на access_token
6. Вызывать Gemini API с Bearer token

**Библиотеки**: `google-auth-library`, или вручную через Electron `BrowserWindow`.

---

### 3. Browser Bridge (прямое дублирование в Gemini)

**Суть**: Открыть Gemini (gemini.google.com) в скрытом или видимом Electron `BrowserWindow` и программно вводить текст в его поле ввода.

**Плюсы**:
- Не нужен API-ключ
- Бесплатно (используется Gemini Free Tier пользователя)
- Нет лимитов API

**Минусы**:
- Хрупкий подход (зависит от DOM-структуры Gemini)
- Google может менять интерфейс → ломается
- Требует авторизации в Google-аккаунт в BrowserWindow
- Скорость зависит от UI Gemini

**Реализация (концепция)**:
```javascript
// electron/gemini-bridge.cjs
const { BrowserWindow } = require('electron');

function createGeminiWindow() {
  const geminiWin = new BrowserWindow({
    width: 800,
    height: 600,
    show: false, // скрытое окно
    webPreferences: {
      partition: 'persist:gemini' // сохраняет сессию
    }
  });

  geminiWin.loadURL('https://gemini.google.com/app');
  return geminiWin;
}

async function sendToGemini(geminiWin, message) {
  // Вставить текст в поле ввода и "нажать" отправить
  await geminiWin.webContents.executeJavaScript(`
    const textarea = document.querySelector('textarea, [contenteditable]');
    if (textarea) {
      textarea.value = ${JSON.stringify(message)};
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      // Найти кнопку отправки
      const sendBtn = document.querySelector('button[aria-label="Send"]');
      if (sendBtn) sendBtn.click();
    }
  `);

  // Подождать и извлечь ответ — нужен MutationObserver или polling
  // Это самая сложная часть: парсинг ответа из DOM
}
```

> **⚠️ Внимание**: Этот подход — самый нестабильный. Google может в любой момент изменить DOM Gemini. Рекомендуется только как эксперимент или fallback.

---

## Рекомендация

Для MVP рекомендую начать с **API Key** — это самый быстрый путь к рабочему прототипу. Позже можно добавить OAuth как production-решение.

**Browser Bridge** — интересный хак, но не подходит для надёжного продукта. Используй его только если нужен бесплатный доступ без ключа и ты готов чинить селекторы при каждом обновлении Gemini.

## Интеграция с Sidebar

Текущий мок в `Sidebar.jsx` (`setTimeout` + фиксированный ответ) нужно заменить вызовом `sendMessage()` из `agent.js`:

```javascript
import { sendMessage } from '../ai/agent';

// Вместо setTimeout с мок-ответом:
const response = await sendMessage(question, selectedText);
updateActiveSession(s => ({
  ...s,
  messages: [...s.messages, { role: 'assistant', text: response }]
}));
```

## Файлы

| Файл | Назначение |
|---|---|
| `agent.js` | Экспорт `sendMessage()` — основная точка входа для Sidebar |
| `README.md` | Этот файл — документация по подходам |
