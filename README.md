# Books Agent

> ⚠️ **Work in Progress** — ИИ-модуль ещё не подключён. Чат работает в режиме заглушки. Приложение полностью функционально как PDF-ридер.

Desktop-приложение для чтения технических PDF-книг с интегрированным ИИ-ассистентом. Electron + React + Vite.

## Возможности

- 📖 PDF-ридер с масштабированием (авто, по ширине, ручной зум)
- 🎯 Выделение текста и фрагментов
- 📑 Навигация по оглавлению (TOC)
- 💬 Чат-интерфейс (ИИ-бэкенд в разработке)
- 📚 Локальная библиотека PDF
- 🌙 Светлая / тёмная тема (Golang-стиль)

## Статус

| Модуль | Статус |
|---|---|
| PDF Viewer | ✅ Готов |
| Zoom / Auto-scale | ✅ Готов |
| TOC Navigation | ✅ Готов |
| Chat UI | ✅ Готов |
| AI Backend | 🔧 В разработке |
| Electron Build | ✅ Готов |

## Запуск

```bash
npm install
npm run dev            # Vite (браузер)
npm run dev:electron   # Electron
npm run build:mac      # Сборка DMG
```

## Структура

```
├── electron/          # Main process
├── public/            # pdf.worker
├── assets/            # Иконка приложения
├── src/
│   ├── ai/            # ИИ-агент (заглушка + README)
│   ├── components/    # React-компоненты
│   ├── App.jsx
│   ├── index.css      # Стили + дизайн-токены
│   └── main.jsx
├── books/             # PDF-файлы (не в git)
└── package.json
```
