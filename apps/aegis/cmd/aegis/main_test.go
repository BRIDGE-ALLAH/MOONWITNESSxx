package main

import (
	"context"
	"errors"
	"net"
	"net/http"
	"testing"
	"time"
)

func startTestServer(t *testing.T, handler http.Handler) (*http.Server, string, <-chan error) {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	server := &http.Server{Handler: handler}
	serveErrors := make(chan error, 1)
	go func() { serveErrors <- server.Serve(listener) }()
	return server, "http://" + listener.Addr().String(), serveErrors
}

func TestShutdownHTTPServerWaitsForActiveRequest(t *testing.T) {
	started := make(chan struct{})
	release := make(chan struct{})
	server, address, serveErrors := startTestServer(t, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		close(started)
		<-release
		w.WriteHeader(http.StatusOK)
	}))

	responseDone := make(chan error, 1)
	go func() {
		response, err := http.Get(address)
		if err != nil {
			responseDone <- err
			return
		}
		_ = response.Body.Close()
		if response.StatusCode != http.StatusOK {
			responseDone <- errors.New("active request did not complete successfully")
			return
		}
		responseDone <- nil
	}()
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("request did not reach the handler")
	}

	shutdownDone := make(chan error, 1)
	go func() { shutdownDone <- shutdownHTTPServer(server, time.Second) }()
	select {
	case err := <-shutdownDone:
		t.Fatalf("shutdown returned before active request completed: %v", err)
	case <-time.After(25 * time.Millisecond):
	}

	close(release)
	if err := <-shutdownDone; err != nil {
		t.Fatalf("graceful shutdown: %v", err)
	}
	if err := <-responseDone; err != nil {
		t.Fatalf("active request: %v", err)
	}
	if err := <-serveErrors; !errors.Is(err, http.ErrServerClosed) {
		t.Fatalf("Serve() error = %v, want http.ErrServerClosed", err)
	}
}

func TestShutdownHTTPServerForcesCloseWhenDeadlineExpires(t *testing.T) {
	started := make(chan struct{})
	server, address, serveErrors := startTestServer(t, http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		close(started)
		<-r.Context().Done()
	}))

	responseDone := make(chan error, 1)
	go func() {
		_, err := http.Get(address)
		responseDone <- err
	}()
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("request did not reach the handler")
	}

	err := shutdownHTTPServer(server, 10*time.Millisecond)
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("shutdown error = %v, want context deadline exceeded", err)
	}
	if err := <-serveErrors; !errors.Is(err, http.ErrServerClosed) {
		t.Fatalf("Serve() error = %v, want http.ErrServerClosed", err)
	}
	select {
	case <-responseDone:
	case <-time.After(time.Second):
		t.Fatal("request did not exit after forced close")
	}
}
