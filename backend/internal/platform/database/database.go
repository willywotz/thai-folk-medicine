// Package database opens the Postgres pool and runs migrations.
package database

import (
	"context"
	"database/sql"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib"

	"github.com/willywotz/thai-folk-medicine/backend/migrations"
)

// NewPool opens a Postgres connection pool.
func NewPool(ctx context.Context, url string) (*pgxpool.Pool, error) {
	return pgxpool.New(ctx, url)
}

// Migrate applies every up migration from the embedded files.
func Migrate(url string) error {
	source, err := iofs.New(migrations.FS, ".")
	if err != nil {
		return err
	}

	db, err := sql.Open("pgx", url)
	if err != nil {
		return err
	}
	defer db.Close()

	driver, err := postgres.WithInstance(db, &postgres.Config{})
	if err != nil {
		return err
	}

	m, err := migrate.NewWithInstance("iofs", source, "postgres", driver)
	if err != nil {
		return err
	}

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return err
	}
	return nil
}
