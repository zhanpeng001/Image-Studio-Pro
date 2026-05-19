package config

import "os"

type Config struct {
	Host      string
	Port      string
	Version   string
	StaticDir string
}

func Load() Config {
	return Config{
		Host:      envOrDefault("APP_HOST", "127.0.0.1"),
		Port:      envOrDefault("APP_PORT", "8080"),
		Version:   envOrDefault("APP_VERSION", "dev"),
		StaticDir: envOrDefault("STATIC_DIR", "../frontend/.output/public"),
	}
}

func envOrDefault(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}
