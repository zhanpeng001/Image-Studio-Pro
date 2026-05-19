package main

import (
	"log"
	"net/http"

	"image-studio-pro/backend/internal/config"
	"image-studio-pro/backend/internal/httpapi"
)

func main() {
	cfg := config.Load()
	addr := cfg.Host + ":" + cfg.Port
	handler := httpapi.NewRouter(httpapi.Options{
		Version:   cfg.Version,
		StaticDir: cfg.StaticDir,
	})

	log.Printf("Image Studio Pro backend listening on http://%s", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatal(err)
	}
}
