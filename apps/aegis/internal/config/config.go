package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	Host              string
	Port              int
	ReadHeaderTimeout time.Duration
	ShutdownTimeout   time.Duration
}

func Load() (Config, error) {
	cfg := Config{
		Host:              envOr("AEGIS_HOST", "0.0.0.0"),
		Port:              3102,
		ReadHeaderTimeout: 5 * time.Second,
		ShutdownTimeout:   10 * time.Second,
	}

	if raw := os.Getenv("AEGIS_PORT"); raw != "" {
		port, err := strconv.Atoi(raw)
		if err != nil || port < 1 || port > 65535 {
			return Config{}, fmt.Errorf("AEGIS_PORT must be an integer between 1 and 65535")
		}
		cfg.Port = port
	}
	if raw := os.Getenv("AEGIS_READ_HEADER_TIMEOUT"); raw != "" {
		duration, err := time.ParseDuration(raw)
		if err != nil || duration <= 0 {
			return Config{}, fmt.Errorf("AEGIS_READ_HEADER_TIMEOUT must be a positive duration")
		}
		cfg.ReadHeaderTimeout = duration
	}
	if raw := os.Getenv("AEGIS_SHUTDOWN_TIMEOUT"); raw != "" {
		duration, err := time.ParseDuration(raw)
		if err != nil || duration <= 0 {
			return Config{}, fmt.Errorf("AEGIS_SHUTDOWN_TIMEOUT must be a positive duration")
		}
		cfg.ShutdownTimeout = duration
	}

	return cfg, nil
}

func (c Config) Address() string {
	return fmt.Sprintf("%s:%d", c.Host, c.Port)
}

func envOr(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
