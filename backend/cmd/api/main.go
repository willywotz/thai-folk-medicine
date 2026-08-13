// Command api starts the Thai folk-medicine HTTP API.
package main

import (
	"context"
	"log/slog"
	"os"
	"time"

	"golang.org/x/crypto/bcrypt"

	httpapi "github.com/willywotz/thai-folk-medicine/backend/internal/adapter/http"
	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository"
	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository/db"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/event"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/staff"
	"github.com/willywotz/thai-folk-medicine/backend/internal/platform/config"
	"github.com/willywotz/thai-folk-medicine/backend/internal/platform/database"
	"github.com/willywotz/thai-folk-medicine/backend/internal/platform/eventbus"
	"github.com/willywotz/thai-folk-medicine/backend/internal/platform/token"
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

	if err := bootstrapAdmin(context.Background(), repository.NewStaff(queries), cfg, logger); err != nil {
		logger.Error("bootstrap admin", "error", err)
		os.Exit(1)
	}

	bus := eventbus.New(logger)
	bus.Subscribe("healer.created", auditHandler(logger))
	bus.Subscribe("healer.updated", auditHandler(logger))
	bus.Subscribe("healer.deleted", auditHandler(logger))
	bus.Subscribe("remedy.created", auditHandler(logger))
	bus.Subscribe("remedy.updated", auditHandler(logger))
	bus.Subscribe("remedy.deleted", auditHandler(logger))
	bus.Subscribe("treatmentcase.created", auditHandler(logger))
	bus.Subscribe("treatmentcase.updated", auditHandler(logger))
	bus.Subscribe("treatmentcase.deleted", auditHandler(logger))

	locationHandler := httpapi.NewLocationHandler(
		usecase.NewLocationService(repository.NewLocation(queries)),
	)
	healerHandler := httpapi.NewHealerHandler(
		usecase.NewHealerService(repository.NewHealer(queries), bus),
	)
	remedyHandler := httpapi.NewRemedyHandler(
		usecase.NewRemedyService(repository.NewRemedy(queries), bus),
	)
	treatmentCaseHandler := httpapi.NewTreatmentCaseHandler(
		usecase.NewTreatmentCaseService(repository.NewTreatmentCase(queries), bus),
	)

	tokenManager := token.NewManager(cfg.JWTSecret, 24*time.Hour)
	authMiddleware := httpapi.NewAuthMiddleware(tokenManager)
	authHandler := httpapi.NewAuthHandler(usecase.NewAuthService(repository.NewStaff(queries), tokenManager))

	router := httpapi.NewRouter(authMiddleware, authHandler, locationHandler, healerHandler, remedyHandler, treatmentCaseHandler)

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

// bootstrapAdmin creates the first staff user from env when the table is empty.
func bootstrapAdmin(ctx context.Context, repo *repository.Staff, cfg config.Config, logger *slog.Logger) error {
	if cfg.StaffAdminUsername == "" || cfg.StaffAdminPassword == "" {
		return nil
	}
	count, err := repo.Count(ctx)
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(cfg.StaffAdminPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	if _, err := repo.Create(ctx, staff.CreateParams{
		Username:     cfg.StaffAdminUsername,
		Email:        cfg.StaffAdminEmail,
		PasswordHash: string(hash),
	}); err != nil {
		return err
	}
	logger.Info("created admin staff user", "username", cfg.StaffAdminUsername)
	return nil
}
