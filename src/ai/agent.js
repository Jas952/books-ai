/**
 * AI Agent stub — replace with real implementation.
 * See README.md for integration approaches.
 */

/**
 * @param {string} message - user question
 * @param {string} context - selected PDF text
 * @param {object} [options] - apiKey, model, etc.
 * @returns {Promise<string>}
 */
export async function sendMessage(message, context = '', options = {}) {
  // TODO: connect real AI backend
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(
        `Это заглушка. Подключите бэкенд в \`src/ai/agent.js\`.\n\n` +
        `**Вопрос**: ${message}\n\n` +
        (context ? `**Контекст** (${context.length} симв.): "${context.slice(0, 100)}..."` : '**Контекст**: не выбран')
      );
    }, 800);
  });
}
