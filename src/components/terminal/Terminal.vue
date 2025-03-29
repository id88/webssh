<template>
  <div class="terminal-container" ref="terminalRef">
    <!-- Terminal will be mounted here -->
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'

// 组件属性定义
const props = defineProps<{
  sessionId?: string
}>()

// 组件事件
const emit = defineEmits<{
  (e: 'data', data: string): void
  (e: 'resize', size: { cols: number; rows: number }): void
}>()

// refs
const terminalRef = ref<HTMLElement>()
const term = ref<Terminal>()
const fitAddon = ref<FitAddon>()

// 初始化终端
onMounted(() => {
  if (!terminalRef.value) return

  // 创建终端实例
  term.value = new Terminal({
    cursorBlink: true,
    theme: {
      background: '#1e1e1e',
      foreground: '#ffffff'
    }
  })

  // 添加 FitAddon
  fitAddon.value = new FitAddon()
  term.value.loadAddon(fitAddon.value)

  // 打开终端
  term.value.open(terminalRef.value)
  fitAddon.value.fit()

  // 监听数据输入
  term.value.onData((data) => {
    emit('data', data)
  })

  // 监听窗口大小变化
  const handleResize = () => {
    if (fitAddon.value && term.value) {
      fitAddon.value.fit()
      const { cols, rows } = term.value
      emit('resize', { cols, rows })
    }
  }

  window.addEventListener('resize', handleResize)

  // 初始化完成后触发一次 resize
  handleResize()
})

// 清理
onBeforeUnmount(() => {
  window.removeEventListener('resize', () => {})
  term.value?.dispose()
})

// 暴露方法给父组件
defineExpose({
  write: (data: string) => {
    term.value?.write(data)
  },
  clear: () => {
    term.value?.clear()
  }
})
</script>

<style scoped>
.terminal-container {
  width: 100%;
  height: 100%;
  background-color: #1e1e1e;
  padding: 8px;
  border-radius: 4px;
}
</style> 