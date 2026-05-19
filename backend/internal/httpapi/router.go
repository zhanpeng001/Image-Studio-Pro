package httpapi

import (
	"encoding/json"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
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

	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not_found"})
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

	staticRoot, err := filepath.Abs(staticDir)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	staticRoot = filepath.Clean(staticRoot)

	cleanPath := path.Clean("/" + r.URL.Path)
	relativePath := strings.TrimPrefix(cleanPath, "/")
	if relativePath == "." || relativePath == "" {
		relativePath = "index.html"
	}
	if strings.Contains(relativePath, `\`) || filepath.VolumeName(relativePath) != "" {
		http.NotFound(w, r)
		return
	}

	target := filepath.Join(staticRoot, filepath.FromSlash(relativePath))
	if !isUnderRoot(staticRoot, target) {
		http.NotFound(w, r)
		return
	}

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

func isUnderRoot(root string, target string) bool {
	targetAbs, err := filepath.Abs(target)
	if err != nil {
		return false
	}
	targetAbs = filepath.Clean(targetAbs)

	rel, err := filepath.Rel(root, targetAbs)
	if err != nil {
		return false
	}
	return rel == "." || (rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator)))
}
