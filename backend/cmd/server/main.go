package main

import (
	"log"
	"net"
	"net/http"
	"time"

	"image-studio-pro/backend/internal/config"
	"image-studio-pro/backend/internal/httpapi"
)

func main() {
	cfg := config.Load()
	addr := net.JoinHostPort(cfg.Host, cfg.Port)
	handler := httpapi.NewRouter(httpapi.Options{
		Version:   cfg.Version,
		StaticDir: cfg.StaticDir,
	})
	server := &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("Image Studio Pro backend listening on http://%s", addr)
	if err := server.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
