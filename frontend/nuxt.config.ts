export default defineNuxtConfig({
  ssr: false,
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
    }
  }
})
