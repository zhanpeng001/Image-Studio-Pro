export function useEditor() {
  let cleanupEditor: (() => void) | undefined
  let disposed = false

  onMounted(async () => {
    if (!import.meta.client) {
      return
    }

    const { initEditor } = await import('~/lib/editor/main')
    if (disposed) {
      return
    }
    cleanupEditor = initEditor()
  })

  onUnmounted(() => {
    disposed = true
    cleanupEditor?.()
    cleanupEditor = undefined
  })
}
