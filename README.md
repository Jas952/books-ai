# Books Agent

![UI Main](assets/main.png)


Desktop-приложение для чтения технических PDF-книг с интегрированным ИИ-ассистентом. 


## Запуск

```bash
npm install
npm run dev            # Vite (браузер)
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
