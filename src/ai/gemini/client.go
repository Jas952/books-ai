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
	"time"
)

type RouterRequest struct {
	Model    string    `json:"model"`
	Messages []Message `json:"messages"`
	Stream   bool      `json:"stream"` 
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
	if len(c.Models) == 0 {
		return "", fmt.Errorf("модель не задана")
	}

	// 9router handles fallback internally based on the Combo name (c.Models[0])
	targetModel := c.Models[0]

	log.Printf("[RouterClient] Запрос к роутеру: model=%s, baseURL=%s", targetModel, c.BaseURL)

	reply, err := c.executeRequest(ctx, prompt, targetModel)
	if err != nil {
		log.Printf("[ОШИБКА 9ROUTER] Не удалось получить ответ от модели %s: %v", targetModel, err)
		return "", fmt.Errorf("ошибка роутера (модель %s): %w", targetModel, err)
	}

	log.Printf("[RouterClient] Успешный ответ от модели %s: %d символов", targetModel, len(reply))
	return reply, nil
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
		dump := c.createErrorDump(jsonData, nil, 0, err.Error())
		_ = os.WriteFile("gemini_error_dump.json", dump, 0644)
		return "", fmt.Errorf("ошибка отправки запроса через роутер: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		dump := c.createErrorDump(jsonData, nil, resp.StatusCode, err.Error())
		_ = os.WriteFile("gemini_error_dump.json", dump, 0644)
		return "", fmt.Errorf("не удалось прочитать поток ответа: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		dump := c.createErrorDump(jsonData, respBody, resp.StatusCode, "")
		_ = os.WriteFile("gemini_error_dump.json", dump, 0644)
		return "", fmt.Errorf("роутер вернул статус-ошибку: %d. Подробности в gemini_error_dump.json", resp.StatusCode)
	}

	var routerResp RouterResponse
	if err := json.Unmarshal(respBody, &routerResp); err != nil {
		dump := c.createErrorDump(jsonData, respBody, resp.StatusCode, err.Error())
		_ = os.WriteFile("gemini_error_dump.json", dump, 0644)
		return "", fmt.Errorf("сервер прислал ТЕКСТ вместо JSON. Содержимое: \n>>> %s\n<<<", string(respBody))
	}

	if len(routerResp.Choices) > 0 {
		return routerResp.Choices[0].Message.Content, nil
	}

	return "", fmt.Errorf("получен пустой ответ от архитектуры роутера (choices пустой)")
}

// createErrorDump создает детальный дамп ошибки для диагностики
func (c *RouterClient) createErrorDump(requestBody []byte, responseBody []byte, statusCode int, errorMsg string) []byte {
	dump := map[string]interface{}{
		"timestamp":   time.Now().Format(time.RFC3339),
		"baseURL":     c.BaseURL,
		"models":      c.Models,
		"endpoint":    "/v1/chat/completions",
		"requestBody": json.RawMessage(requestBody),
		"statusCode":  statusCode,
	}
	if responseBody != nil {
		dump["responseBody"] = string(responseBody)
	}
	if errorMsg != "" {
		dump["error"] = errorMsg
	}
	// Маскируем API ключ для безопасности
	if c.APIKey != "" {
		if len(c.APIKey) > 8 {
			dump["apiKeyMasked"] = c.APIKey[:4] + "..." + c.APIKey[len(c.APIKey)-4:]
		} else {
			dump["apiKeyMasked"] = "***"
		}
	}
	result, _ := json.MarshalIndent(dump, "", "    ")
	return result
}
