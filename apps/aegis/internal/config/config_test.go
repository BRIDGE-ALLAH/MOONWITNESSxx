package config

import (
	"testing"
	"time"
)

func TestLoadDefaults(t *testing.T) {
	t.Setenv("AEGIS_HOST", "")
	t.Setenv("AEGIS_PORT", "")
	t.Setenv("AEGIS_READ_HEADER_TIMEOUT", "")
	t.Setenv("AEGIS_SHUTDOWN_TIMEOUT", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.Address() != "0.0.0.0:3102" {
		t.Fatalf("Address() = %q", cfg.Address())
	}
	if cfg.ReadHeaderTimeout != 5*time.Second || cfg.ShutdownTimeout != 10*time.Second {
		t.Fatalf("unexpected timeout defaults: %+v", cfg)
	}
}

func TestLoadRejectsInvalidPort(t *testing.T) {
	t.Setenv("AEGIS_PORT", "70000")
	if _, err := Load(); err == nil {
		t.Fatal("expected invalid port to fail")
	}
}

func TestLoadRejectsInvalidTimeout(t *testing.T) {
	t.Setenv("AEGIS_READ_HEADER_TIMEOUT", "0s")
	if _, err := Load(); err == nil {
		t.Fatal("expected non-positive timeout to fail")
	}
}

func TestLoadCustomValues(t *testing.T) {
	t.Setenv("AEGIS_HOST", "127.0.0.1")
	t.Setenv("AEGIS_PORT", "9999")
	t.Setenv("AEGIS_READ_HEADER_TIMEOUT", "2s")
	t.Setenv("AEGIS_SHUTDOWN_TIMEOUT", "3s")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.Address() != "127.0.0.1:9999" {
		t.Fatalf("Address() = %q", cfg.Address())
	}
	if cfg.ReadHeaderTimeout != 2*time.Second || cfg.ShutdownTimeout != 3*time.Second {
		t.Fatalf("unexpected custom timeouts: %+v", cfg)
	}
}
