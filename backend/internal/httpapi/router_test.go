package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestHealthRoute(t *testing.T) {
	handler := NewRouter(Options{Version: "test", StaticDir: ""})
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body["status"] != "ok" {
		t.Fatalf("expected status ok, got %q", body["status"])
	}
}

func TestVersionRoute(t *testing.T) {
	handler := NewRouter(Options{Version: "1.2.3", StaticDir: ""})
	req := httptest.NewRequest(http.MethodGet, "/api/version", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body["version"] != "1.2.3" {
		t.Fatalf("expected version 1.2.3, got %q", body["version"])
	}
}

func TestStaticRootServesIndex(t *testing.T) {
	staticDir := newStaticDir(t)
	handler := NewRouter(Options{Version: "test", StaticDir: staticDir})
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "index page") {
		t.Fatalf("expected index body, got %q", rec.Body.String())
	}
}

func TestStaticConcreteAsset(t *testing.T) {
	staticDir := newStaticDir(t)
	handler := NewRouter(Options{Version: "test", StaticDir: staticDir})
	req := httptest.NewRequest(http.MethodGet, "/assets/app.js", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if strings.TrimSpace(rec.Body.String()) != "console.log('asset')" {
		t.Fatalf("expected asset body, got %q", rec.Body.String())
	}
}

func TestStaticFrontendRouteFallsBackToIndex(t *testing.T) {
	staticDir := newStaticDir(t)
	handler := NewRouter(Options{Version: "test", StaticDir: staticDir})
	req := httptest.NewRequest(http.MethodGet, "/projects/123", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "index page") {
		t.Fatalf("expected index body, got %q", rec.Body.String())
	}
}

func TestMissingStaticDirReturnsNotFound(t *testing.T) {
	handler := NewRouter(Options{Version: "test", StaticDir: filepath.Join(t.TempDir(), "missing")})
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func TestUnknownAPIRouteReturnsJSONNotFound(t *testing.T) {
	staticDir := newStaticDir(t)
	handler := NewRouter(Options{Version: "test", StaticDir: staticDir})
	req := httptest.NewRequest(http.MethodGet, "/api/unknown", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
	if contentType := rec.Header().Get("Content-Type"); contentType != "application/json" {
		t.Fatalf("expected JSON content type, got %q", contentType)
	}

	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body["error"] == "" {
		t.Fatalf("expected JSON error body, got %#v", body)
	}
}

func TestEncodedTraversalCannotEscapeStaticRoot(t *testing.T) {
	parentDir := t.TempDir()
	staticDir := filepath.Join(parentDir, "public")
	if err := os.MkdirAll(staticDir, 0o755); err != nil {
		t.Fatalf("create static dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(staticDir, "index.html"), []byte("index page"), 0o644); err != nil {
		t.Fatalf("write index: %v", err)
	}
	if err := os.WriteFile(filepath.Join(parentDir, "secret.txt"), []byte("secret outside root"), 0o644); err != nil {
		t.Fatalf("write secret: %v", err)
	}

	handler := NewRouter(Options{Version: "test", StaticDir: staticDir})
	req := httptest.NewRequest(http.MethodGet, "/%2e%2e/secret.txt", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Body.String() == "secret outside root" {
		t.Fatalf("served file outside static root")
	}
	if rec.Code == http.StatusOK {
		t.Fatalf("expected non-200 response, got %d with body %q", rec.Code, rec.Body.String())
	}
}

func TestBackslashTraversalCannotEscapeStaticRoot(t *testing.T) {
	parentDir := t.TempDir()
	staticDir := filepath.Join(parentDir, "public")
	if err := os.MkdirAll(staticDir, 0o755); err != nil {
		t.Fatalf("create static dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(staticDir, "index.html"), []byte("index page"), 0o644); err != nil {
		t.Fatalf("write index: %v", err)
	}
	if err := os.WriteFile(filepath.Join(parentDir, "secret.txt"), []byte("secret outside root"), 0o644); err != nil {
		t.Fatalf("write secret: %v", err)
	}

	handler := NewRouter(Options{Version: "test", StaticDir: staticDir})
	req := httptest.NewRequest(http.MethodGet, "/..%5csecret.txt", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Body.String() == "secret outside root" {
		t.Fatalf("served file outside static root")
	}
	if rec.Code == http.StatusOK {
		t.Fatalf("expected non-200 response, got %d with body %q", rec.Code, rec.Body.String())
	}
}

func newStaticDir(t *testing.T) string {
	t.Helper()

	staticDir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(staticDir, "assets"), 0o755); err != nil {
		t.Fatalf("create assets dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(staticDir, "index.html"), []byte("<html>index page</html>"), 0o644); err != nil {
		t.Fatalf("write index: %v", err)
	}
	if err := os.WriteFile(filepath.Join(staticDir, "assets", "app.js"), []byte("console.log('asset')"), 0o644); err != nil {
		t.Fatalf("write asset: %v", err)
	}

	return staticDir
}
