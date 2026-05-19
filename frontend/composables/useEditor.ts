export function useEditor() {
  onMounted(async () => {
    if (!import.meta.client) {
      return
    }

    const { initEditor } = await import('~/lib/editor/main')
    initEditor()
  })
}
