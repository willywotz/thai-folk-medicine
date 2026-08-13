// Command api starts the Thai folk-medicine HTTP API.
package main

import (
	"context"
	"log/slog"
	"os"

	httpapi "github.com/willywotz/thai-folk-medicine/backend/internal/adapter/http"
	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository"
	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository/db"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/event"
	"github.com/willywotz/thai-folk-medicine/backend/internal/platform/config"
	"github.com/willywotz/thai-folk-medicine/backend/internal/platform/database"
	"github.com/willywotz/thai-folk-medicine/backend/internal/platform/eventbus"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	cfg, err := config.Load()
	if err != nil {
		logger.Error("load config", "error", err)
		os.Exit(1)
	}

	if err := database.Migrate(cfg.DatabaseURL); err != nil {
		logger.Error("run migrations", "error", err)
		os.Exit(1)
	}

	pool, err := database.NewPool(context.Background(), cfg.DatabaseURL)
	if err != nil {
		logger.Error("open pool", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	queries := db.New(pool)

	bus := eventbus.New(logger)
	bus.Subscribe("healer.created", auditHandler(logger))
	bus.Subscribe("healer.updated", auditHandler(logger))
	bus.Subscribe("healer.deleted", auditHandler(logger))
	bus.Subscribe("remedy.created", auditHandler(logger))
	bus.Subscribe("remedy.updated", auditHandler(logger))
	bus.Subscribe("remedy.deleted", auditHandler(logger))

	locationHandler := httpapi.NewLocationHandler(
		usecase.NewLocationService(repository.NewLocation(queries)),
	)
	healerHandler := httpapi.NewHealerHandler(
		usecase.NewHealerService(repository.NewHealer(queries), bus),
	)
	remedyHandler := httpapi.NewRemedyHandler(
		usecase.NewRemedyService(repository.NewRemedy(queries), bus),
	)

	router := httpapi.NewRouter(locationHandler, healerHandler, remedyHandler)

	logger.Info("starting server", "port", cfg.HTTPPort)
	if err := router.Run(":" + cfg.HTTPPort); err != nil {
		logger.Error("server stopped", "error", err)
		os.Exit(1)
	}
}

// auditHandler logs each domain event. It is the first event subscriber.
func auditHandler(logger *slog.Logger) event.Handler {
	return func(ctx context.Context, e event.Event) error {
		logger.InfoContext(ctx, "audit", "event", e.EventName())
		return nil
	}
}
