// Command api starts the Thai folk-medicine HTTP API.
package main

import (
	"log/slog"
	"os"

	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/http"
	"github.com/willywotz/thai-folk-medicine/backend/internal/platform/config"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	cfg, err := config.Load()
	if err != nil {
		logger.Error("load config", "error", err)
		os.Exit(1)
	}

	router := httpapi.NewRouter()

	logger.Info("starting server", "port", cfg.HTTPPort)
	if err := router.Run(":" + cfg.HTTPPort); err != nil {
		logger.Error("server stopped", "error", err)
		os.Exit(1)
	}
}
