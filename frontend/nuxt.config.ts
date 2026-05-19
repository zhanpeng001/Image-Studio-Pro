export default defineNuxtConfig({
  ssr: false,
  nitro: {
    preset: 'static'
  },
  devtools: { enabled: true },
  css: ['~/assets/css/editor.css'],
  app: {
    head: {
      title: 'Image Studio Pro',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Private browser-local image editor' }
      ]
    }
  },
  vite: {
    optimizeDeps: {
      include: ['jszip']
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8080',
          changeOrigin: true
        }
      }
    }
  }
})
