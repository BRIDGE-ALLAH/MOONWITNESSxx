package main

import (
	"context"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/BRIDGE-ALLAH/MOONWITNESS/apps/aegis/internal/config"
	aegishttp "github.com/BRIDGE-ALLAH/MOONWITNESS/apps/aegis/internal/httpserver"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	cfg, err := config.Load()
	if err != nil {
		logger.Error("invalid configuration", "error", err)
		os.Exit(1)
	}

	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		client := http.Client{Timeout: 2 * time.Second}
		response, err := client.Get("http://127.0.0.1:" + strconv.Itoa(cfg.Port) + "/health/ready")
		if err != nil {
			os.Exit(1)
		}
		_ = response.Body.Close()
		if response.StatusCode != http.StatusOK {
			os.Exit(1)
		}
		return
	}

	listener, err := net.Listen("tcp", cfg.Address())
	if err != nil {
		logger.Error("unable to bind AEGIS HTTP listener", "address", cfg.Address(), "error", err)
		os.Exit(1)
	}

	server := &http.Server{
		Addr:              cfg.Address(),
		Handler:           aegishttp.NewHandler(logger),
		ReadHeaderTimeout: cfg.ReadHeaderTimeout,
	}

	signals, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	serverErrors := make(chan error, 1)
	go func() {
		logger.Info("AEGIS HTTP server starting", "address", cfg.Address())
		serverErrors <- server.Serve(listener)
	}()

	select {
	case err := <-serverErrors:
		if !errors.Is(err, http.ErrServerClosed) {
			logger.Error("AEGIS HTTP server stopped unexpectedly", "error", err)
			os.Exit(1)
		}
	case <-signals.Done():
		ctx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
		defer cancel()
		logger.Info("AEGIS graceful shutdown started")
		if err := server.Shutdown(ctx); err != nil {
			logger.Error("graceful shutdown failed", "error", err)
			if closeErr := server.Close(); closeErr != nil {
				logger.Error("forced server close failed", "error", closeErr)
			}
			os.Exit(1)
		}
		if err := <-serverErrors; err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("AEGIS HTTP server shutdown failed", "error", err)
			os.Exit(1)
		}
		logger.Info("AEGIS stopped")
	}
}
