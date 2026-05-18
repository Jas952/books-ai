package gemini

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
)

type RouterRequest struct {
	Model    string    `json:"model"`
	Messages []Message `json:"messages"`
	Stream   bool      `json:"stream"` // 1. ИСПРАВЛЕНО: Добавили поле управления потоком
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type RouterResponse struct {
	Choices []Choice `json:"choices"`
}

type Choice struct {
	Message Message `json:"message"`
}

type RouterClient struct {
	BaseURL string
	APIKey  string
	Models  []string
}

func NewRouterClient(baseURL, apiKey string, models []string) *RouterClient {
	return &RouterClient{
		BaseURL: baseURL,
		APIKey:  apiKey,
		Models:  models,
	}
}

func (c *RouterClient) SendPrompt(ctx context.Context, prompt string) (string, error) {
	var lastErr error

	for i, model := range c.Models {
		if i > 0 {
			log.Printf("[FAILOVER] ⚠️ Основная модель дала сбой. Автоматически переключаюсь на резервную: %s", model)
		}

		// Вызываем внутренний метод отправки для конкретной модели
		reply, err := c.executeRequest(ctx, prompt, model)
		if err == nil {
			return reply, nil
		}

		lastErr = err
		log.Printf("[ОШИБКА КАНАЛА] Модель %s вернула ошибку: %v", model, err)
	}

	return "", fmt.Errorf("критическая ошибка: все доступные модели в роутере вернули сбой. Последний лог: %w", lastErr)
}

func (c *RouterClient) executeRequest(ctx context.Context, prompt string, model string) (string, error) {
	url := fmt.Sprintf("%s/v1/chat/completions", c.BaseURL)

	reqBody := RouterRequest{
		Model:    model,
		Messages: []Message{{Role: "user", Content: prompt}},
		Stream:   false,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("ошибка маршалинга запроса: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("ошибка создания HTTP-объекта: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.APIKey))

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("ошибка отправки запроса через роутер: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("не удалось прочитать поток ответа: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		_ = os.WriteFile("gemini_error_dump.json", respBody, 0644)
		return "", fmt.Errorf("роутер вернул статус-ошибку: %d. Подробности в gemini_error_dump.json", resp.StatusCode)
	}

	var routerResp RouterResponse
	if err := json.Unmarshal(respBody, &routerResp); err != nil {
		_ = os.WriteFile("gemini_error_dump.json", respBody, 0644)
		return "", fmt.Errorf("сервер прислал ТЕКСТ вместо JSON. Содержимое: \n>>> %s\n<<<", string(respBody))
	}

	if len(routerResp.Choices) > 0 {
		return routerResp.Choices[0].Message.Content, nil
	}

	return "", fmt.Errorf("получен пустой ответ от архитектуры роутера")
}
