package httpapi

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
)

type Options struct {
	Version   string
	StaticDir string
}

func NewRouter(opts Options) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	mux.HandleFunc("GET /api/version", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"version": opts.Version})
	})

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		serveStaticOrIndex(w, r, opts.StaticDir)
	})

	return mux
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func serveStaticOrIndex(w http.ResponseWriter, r *http.Request, staticDir string) {
	if staticDir == "" {
		http.NotFound(w, r)
		return
	}

	cleanPath := filepath.Clean(r.URL.Path)
	if cleanPath == "." || cleanPath == string(filepath.Separator) {
		cleanPath = "index.html"
	}
	target := filepath.Join(staticDir, cleanPath)

	if info, err := os.Stat(target); err == nil && !info.IsDir() {
		http.ServeFile(w, r, target)
		return
	}

	indexPath := filepath.Join(staticDir, "index.html")
	if _, err := os.Stat(indexPath); err == nil {
		http.ServeFile(w, r, indexPath)
		return
	}

	http.NotFound(w, r)
}
