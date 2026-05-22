# Books Agent

![UI Main](assets/main.png)


Desktop-приложение для чтения технических PDF-книг с интегрированным ИИ-ассистентом. 


## Запуск

```bash
npm install
npm run dev            # Vite (браузер)
npm run dev:electron   # Electron в dev-режиме
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
<p>
  <img src="./assets-github/n1.gif" alt="Project Demo" width="92" height="92" align="left"/>
</p>
<pre hspace="12">
  <img src="./assets-github/contacts/tg.jpg" alt="Telegram" height="14" /> Telegram ······ <a href="https://t.me/Jas953/">t.me/Jas953</a>
  <img src="./assets-github/contacts/lnk.jpg" alt="LinkedIn" height="14" /> LinkedIn ······ <a href="https://www.linkedin.com/in/jas952/">linkedin.com/in/jas952</a>
  <img src="./assets-github/contacts/x.jpg" alt="X" height="14" /> X        ······ <a href="https://x.com/not__jas">x.com/not__jas</a>
</pre>
<br clear="left" />
