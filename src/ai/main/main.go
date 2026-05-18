package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"books/src/ai/gemini"
	"github.com/joho/godotenv"
)

var routerClient *gemini.RouterClient

type ChatRequest struct {
	Message string `json:"message"`
	Context string `json:"context"`
}

type ChatResponse struct {
	Reply string `json:"reply"`
	Error string `json:"error,omitempty"`
}

func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

func chatHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(ChatResponse{Error: "only POST allowed"})
		return
	}

	var req ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ChatResponse{Error: "invalid JSON: " + err.Error()})
		return
	}

	// Формируем финальный промпт с контекстом из PDF
	prompt := req.Message
	if req.Context != "" {
		prompt = fmt.Sprintf(
			"Контекст из книги (выделенный фрагмент):\n\"\"\"\n%s\n\"\"\"\n\nВопрос пользователя: %s",
			req.Context,
			req.Message,
		)
	}

	log.Printf("[CHAT] Запрос: %q (контекст: %d симв.)", req.Message, len(req.Context))

	reply, err := routerClient.SendPrompt(context.Background(), prompt)
	if err != nil {
		log.Printf("[ОШИБКА] %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(ChatResponse{Error: err.Error()})
		return
	}

	log.Printf("[CHAT] Ответ: %d симв.", len(reply))
	json.NewEncoder(w).Encode(ChatResponse{Reply: reply})
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func main() {
	// Пробуем загрузить .env из разных мест
	for _, envPath := range []string{".env", "../../../.env", "../../.env"} {
		if err := godotenv.Load(envPath); err == nil {
			log.Printf("Загружен .env из: %s", envPath)
			break
		}
	}

	baseURL := os.Getenv("ROUTER_BASE_URL")
	apiKey := os.Getenv("ROUTER_API_KEY")
	modelRaw := os.Getenv("ROUTER_MODEL")

	if baseURL == "" || apiKey == "" || modelRaw == "" {
		log.Fatal("Критическая ошибка: Задайте ROUTER_BASE_URL, ROUTER_API_KEY и ROUTER_MODEL в файле .env")
	}

	models := splitModels(modelRaw)
	routerClient = gemini.NewRouterClient(baseURL, apiKey, models)

	port := os.Getenv("AI_SERVER_PORT")
	if port == "" {
		port = "8765"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/chat", corsMiddleware(chatHandler))
	mux.HandleFunc("/health", corsMiddleware(healthHandler))

	addr := "127.0.0.1:" + port
	log.Printf("=== AI HTTP-сервер запущен на %s ===", addr)
	log.Printf("Основная модель: %s", models[0])
	if len(models) > 1 {
		log.Printf("Резервные модели: %v", models[1:])
	}

	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("Не удалось запустить сервер: %v", err)
	}
}

func splitModels(raw string) []string {
	var models []string
	current := ""
	for _, ch := range raw {
		if ch == ',' {
			if t := trimSpace(current); t != "" {
				models = append(models, t)
			}
			current = ""
		} else {
			current += string(ch)
		}
	}
	if t := trimSpace(current); t != "" {
		models = append(models, t)
	}
	return models
}

func trimSpace(s string) string {
	start, end := 0, len(s)
	for start < end && (s[start] == ' ' || s[start] == '\t') {
		start++
	}
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t') {
		end--
	}
	return s[start:end]
}
