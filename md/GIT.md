# Git — Шпаргалка

## Первоначальная настройка

```bash
# Инициализировать репозиторий
git init

# Привязать к GitHub
git remote add origin https://github.com/USER/REPO.git

# Первый коммит и пуш
git add .
git commit -m "first commit"
git branch -M main
git push -u origin main
```

---

## Ежедневная работа

```bash
# Посмотреть что изменилось
git status

# Посмотреть diff изменений
git diff

# Добавить конкретный файл
git add src/App.jsx

# Добавить несколько файлов
git add src/App.jsx src/index.css

# Добавить всю папку
git add src/components/

# Добавить ВСЕ изменения
git add .

# Закоммитить
git commit -m "описание что сделал"

# Запушить на GitHub
git push
```

---

## Частые сценарии

### Обновить всё одной строкой
```bash
git add . && git commit -m "описание" && git push
```

### Забыл добавить файл в последний коммит
```bash
git add забытый_файл.js
git commit --amend --no-edit
git push --force
```

### Отменить изменения в файле (вернуть к последнему коммиту)
```bash
git checkout -- src/App.jsx
```

### Отменить git add (убрать из staging)
```bash
git reset src/App.jsx     # конкретный файл
git reset                 # все файлы
```

### Отменить последний коммит (сохранив изменения)
```bash
git reset --soft HEAD~1
```

### Посмотреть историю коммитов
```bash
git log --oneline -10     # последние 10, коротко
git log                   # полная история
```

---

## Ветки

```bash
# Создать и перейти на ветку
git checkout -b feature/ai-agent

# Переключиться на существующую ветку
git checkout main

# Список веток
git branch

# Слить ветку в main
git checkout main
git merge feature/ai-agent

# Удалить ветку (после слияния)
git branch -d feature/ai-agent
```

---

## Синхронизация

```bash
# Скачать изменения с GitHub
git pull

# Скачать и перебазировать (чище история)
git pull --rebase
```

---

## Теги (для версий)

```bash
# Создать тег
git tag v0.1.0

# Запушить тег
git push origin v0.1.0

# Запушить все теги
git push --tags

# Список тегов
git tag
```

---

## .gitignore — что НЕ попадёт в git

Файл `.gitignore` в корне проекта. Текущий список:
- `node_modules/` — зависимости
- `dist/` — сборка
- `release/` — DMG-файлы
- `books/*.pdf` — PDF-книги
- `.DS_Store` — macOS
- `.env`, `.env.*` — секреты

---

## Полезное

```bash
# Кто и когда менял строки файла
git blame src/App.jsx

# Найти коммит по слову в сообщении
git log --grep="fix"

# Размер репозитория
du -sh .git

# Очистить кеш (если .gitignore не работает)
git rm -r --cached .
git add .
git commit -m "fix gitignore"
```
