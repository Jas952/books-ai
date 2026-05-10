# Релизы и обновления

## Версионирование

Проект использует [Semantic Versioning](https://semver.org/):

```
MAJOR.MINOR.PATCH
  │     │     └── багфиксы (0.1.0 → 0.1.1)
  │     └──────── новые фичи (0.1.0 → 0.2.0)
  └────────────── крупные/ломающие изменения (0.1.0 → 1.0.0)
```

Текущая версия: см. `version` в `package.json`.

---

## Команды

| Команда | Действие | Пример версии |
|---|---|---|
| `npm run version:patch` | Багфикс | 0.1.0 → 0.1.1 |
| `npm run version:minor` | Новая фича | 0.1.0 → 0.2.0 |
| `npm run version:major` | Крупное обновление | 0.1.0 → 1.0.0 |
| `npm run build:mac` | Собрать DMG без публикации | Результат в `release/` |

Каждая `version:*` команда автоматически:
1. Обновляет версию в `package.json`
2. Собирает Vite (frontend)
3. Собирает DMG через electron-builder

Результат: `release/Books Agent-X.X.X-arm64.dmg`

---

## Полный цикл выпуска обновления

### Шаг 1. Внести изменения в код

Пишешь код, тестируешь локально через `npm run dev:electron`.

### Шаг 2. Закоммитить и запушить

```bash
git add .
git commit -m "описание изменений"
git push
```

### Шаг 3. Собрать новую версию

Выбери тип обновления:

```bash
# Мелкий фикс (0.1.0 → 0.1.1)
npm run version:patch

# Новая фича (0.1.0 → 0.2.0)
npm run version:minor

# Крупное обновление (0.1.0 → 1.0.0)
npm run version:major
```

После выполнения в `package.json` обновится версия, а в `release/` появится новый DMG.

### Шаг 4. Закоммитить новую версию

```bash
git add package.json package-lock.json
git commit -m "v0.1.1"
git push
```

### Шаг 5. Создать GitHub Release

**Вариант А — через сайт:**
1. Зайти на `github.com/Jas952/books_ai`
2. Перейти в **Releases** → **Draft a new release**
3. В поле **Tag** ввести: `v0.1.1` (соответствует версии в package.json)
4. **Title**: `v0.1.1`
5. **Description**: кратко что изменилось
6. Перетащить файл `release/Books Agent-0.1.1-arm64.dmg` в область загрузки
7. Нажать **Publish release**

**Вариант Б — через терминал (GitHub CLI):**

```bash
# Установить GitHub CLI (один раз)
brew install gh
gh auth login

# Создать релиз с DMG
gh release create v0.1.1 \
  "release/Books Agent-0.1.1-arm64.dmg" \
  --title "v0.1.1" \
  --notes "Описание изменений"
```

---

## Как это работает у пользователя

```
Пользователь открывает Books Agent
        ↓
electron-updater проверяет GitHub Releases
        ↓
Есть новая версия? → Скачивает DMG в фоне
        ↓
Показывает диалог: "Версия X.X.X загружена. Перезапустить?"
        ↓
Пользователь нажимает "Перезапустить" → приложение обновляется
```

- Первую установку пользователь делает вручную (скачивает DMG)
- Все последующие обновления — автоматически через приложение

---

## Чеклист перед релизом

- [ ] Код протестирован локально (`npm run dev:electron`)
- [ ] Изменения закоммичены и запушены
- [ ] Версия обновлена (`npm run version:patch/minor/major`)
- [ ] `package.json` с новой версией запушен
- [ ] GitHub Release создан с DMG-файлом
