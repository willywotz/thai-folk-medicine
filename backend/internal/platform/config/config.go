// Package config loads runtime settings from environment variables.
package config

import "github.com/caarlos0/env/v11"

// Config holds all runtime settings.
type Config struct {
	HTTPPort           string `env:"HTTP_PORT" envDefault:"8080"`
	DatabaseURL        string `env:"DATABASE_URL,required"`
	JWTSecret          string `env:"JWT_SECRET,required"`
	PhotoStorageDir    string `env:"PHOTO_STORAGE_DIR" envDefault:"./storage/photo"`
	StaffAdminUsername string `env:"STAFF_ADMIN_USERNAME"`
	StaffAdminPassword string `env:"STAFF_ADMIN_PASSWORD"`
	StaffAdminEmail    string `env:"STAFF_ADMIN_EMAIL" envDefault:"admin@example.local"`
}

// Load reads the configuration from the environment.
func Load() (Config, error) {
	var c Config
	if err := env.Parse(&c); err != nil {
		return Config{}, err
	}
	return c, nil
}
