/**
 * AI Agent — подключён к локальному Go HTTP-серверу.
 * Сервер запускается из src/ai/main/main.go и слушает на порту 8765.
 */

const AI_SERVER_URL = 'http://127.0.0.1:8765';

/**
 * Проверить, доступен ли AI-сервер
 * @returns {Promise<boolean>}
 */
export async function checkServerHealth() {
  try {
    const res = await fetch(`${AI_SERVER_URL}/health`, {
      signal: AbortSignal.timeout(2000)
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Отправить сообщение в AI через локальный Go-сервер
 * @param {string} message - вопрос пользователя
 * @param {string} [context] - выделенный текст из PDF
 * @returns {Promise<string>} - ответ AI
 */
export async function sendMessage(message, context = '') {
  try {
    const res = await fetch(`${AI_SERVER_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, context }),
      signal: AbortSignal.timeout(60000) // 60 сек таймаут для долгих ответов
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      throw new Error(data.error || `Сервер вернул ошибку ${res.status}`);
    }

    return data.reply;
  } catch (err) {
    if (err.name === 'TimeoutError') {
      throw new Error('Запрос превысил время ожидания (60 сек). Попробуйте ещё раз.');
    }
    if (err.message.includes('fetch') || err.name === 'TypeError') {
      throw new Error(
        'AI-сервер недоступен. Убедитесь, что Go-сервер запущен:\n' +
        'cd src/ai/main && go run main.go'
      );
    }
    throw err;
  }
}
