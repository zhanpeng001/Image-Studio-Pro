export function useEditor() {
  let cleanupEditor: (() => void) | undefined

  onMounted(async () => {
    if (!import.meta.client) {
      return
    }

    const { initEditor } = await import('~/lib/editor/main')
    cleanupEditor = initEditor()
  })

  onUnmounted(() => {
    cleanupEditor?.()
    cleanupEditor = undefined
  })
}
