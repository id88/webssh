<template>
  <div class="home-container">
    <el-container>
      <el-aside width="300px">
        <div class="sidebar">
          <div class="sidebar-header">
            <h2>WebSSH</h2>
            <el-button type="primary" @click="showConnectionDialog = true">
              新建连接
            </el-button>
          </div>
          <el-scrollbar>
            <el-menu
              :default-active="activeSessionId"
              class="session-list"
              @select="handleSessionSelect"
            >
              <el-menu-item
                v-for="session in sessions"
                :key="session.id"
                :index="session.id"
              >
                <span>{{ session.title }}</span>
                <el-button
                  type="danger"
                  link
                  @click.stop="handleCloseSession(session.id)"
                >
                  关闭
                </el-button>
              </el-menu-item>
            </el-menu>
          </el-scrollbar>
        </div>
      </el-aside>

      <el-main class="main-content">
        <div v-if="activeSessionId" class="terminal-wrapper">
          <Terminal
            :key="activeSessionId"
            :session-id="activeSessionId"
            @data="handleTerminalData"
            @resize="handleTerminalResize"
            ref="terminalRef"
          />
        </div>
        <div v-else class="empty-state">
          <el-empty description="没有活动的会话">
            <el-button type="primary" @click="showConnectionDialog = true">
              新建连接
            </el-button>
          </el-empty>
        </div>
      </el-main>
    </el-container>

    <el-dialog
      v-model="showConnectionDialog"
      title="新建连接"
      width="500px"
      destroy-on-close
    >
      <ConnectionForm @connect="handleConnect" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import Terminal from '@/components/terminal/Terminal.vue'
import ConnectionForm from '@/components/connection/ConnectionForm.vue'
import { wsService } from '@/services/websocket'
import { ElMessage } from 'element-plus'

// 状态
const sessions = ref<Array<{ id: string; title: string }>>([])
const activeSessionId = ref<string>('')
const showConnectionDialog = ref(false)
const terminalRef = ref()

// 计算属性
const activeSession = computed(() => 
  sessions.value.find(s => s.id === activeSessionId.value)
)

// 连接处理
const handleConnect = async (config: {
  host: string
  port: number
  username: string
  password: string
}) => {
  try {
    // 确保WebSocket已连接
    await wsService.connect()

    // 创建新会话
    const clientSessionId = uuidv4()
    const title = `${config.username}@${config.host}:${config.port}`
    let serverSessionId = ''
    const messageBuffer: any[] = [] // 用于缓存早期消息
    
    // 创建一个Promise来等待会话创建
    const sessionCreated = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup(true)
        reject(new Error('会话创建超时'))
      }, 10000) // 10秒超时

      const cleanup = (removeServerCallback = false) => {
        clearTimeout(timeout)
        wsService.unregisterCallback('system')
        wsService.unregisterCallback(clientSessionId)
        wsService.unregisterCallback('*')
        if (removeServerCallback && serverSessionId) {
          wsService.unregisterCallback(serverSessionId)
        }
      }

      // 注册系统消息回调
      wsService.registerCallback('system', (data) => {
        if (data.type === 'error') {
          cleanup(true)
          reject(new Error(data.message))
        } else if (data.sessionId) {
          // 服务器返回了新的会话ID
          serverSessionId = data.sessionId
          console.log('服务器分配的会话ID:', serverSessionId)
          
          // 更新会话列表中的ID
          const session = { id: serverSessionId, title }
          sessions.value.push(session)
          activeSessionId.value = serverSessionId

          // 注册新的会话回调
          wsService.registerCallback(serverSessionId, (message) => {
            if (message.type === 'data') {
              const content = message.content || message.data
              if (typeof content === 'string') {
                terminalRef.value?.write(content)
              }
            } else if (message.type === 'error') {
              console.error('SSH错误:', message.message)
              ElMessage.error(message.message)
            }
          })
          
          // 处理缓存的消息
          console.log('处理缓存的消息:', messageBuffer.length, '条')
          messageBuffer.forEach(message => {
            if (message.type === 'data') {
              const content = message.content || message.data
              if (typeof content === 'string') {
                terminalRef.value?.write(content)
              }
            }
          })
          messageBuffer.length = 0 // 清空缓存
          
          // 只清理临时回调，保留服务器会话回调
          cleanup(false)
          resolve(true)
        }
      })

      // 注册临时回调来捕获早期消息
      wsService.registerCallback(clientSessionId, (message) => {
        messageBuffer.push(message)
      })

      // 注册临时回调来捕获可能的早期服务器会话消息
      wsService.registerCallback('*', (message) => {
        if (message.sessionId && message.sessionId !== 'system' && message.sessionId !== clientSessionId) {
          messageBuffer.push(message)
        }
      })

      // 发送创建会话请求
      wsService.send({
        type: 'create',
        sessionId: clientSessionId,
        config
      })
    })

    // 等待会话创建确认
    await sessionCreated
    showConnectionDialog.value = false
  } catch (error) {
    console.error('连接失败:', error)
    ElMessage.error(error instanceof Error ? error.message : '连接失败')
  }
}

// 会话管理
const handleSessionSelect = (sessionId: string) => {
  activeSessionId.value = sessionId
}

const handleCloseSession = (sessionId: string) => {
  wsService.send({
    type: 'disconnect',
    sessionId
  })
  wsService.unregisterCallback(sessionId)
  
  const index = sessions.value.findIndex(s => s.id === sessionId)
  if (index !== -1) {
    sessions.value.splice(index, 1)
  }

  if (activeSessionId.value === sessionId) {
    activeSessionId.value = sessions.value[0]?.id || ''
  }
}

// 终端事件处理
const handleTerminalData = (data: string) => {
  if (activeSessionId.value) {
    wsService.send({
      type: 'data',
      sessionId: activeSessionId.value,
      content: data
    })
  }
}

const handleTerminalResize = (size: { cols: number; rows: number }) => {
  if (activeSessionId.value) {
    wsService.send({
      type: 'resize',
      sessionId: activeSessionId.value,
      size
    })
  }
}
</script>

<style scoped>
.home-container {
  height: 100%;
}

.sidebar {
  height: 100%;
  border-right: 1px solid #dcdfe6;
  background-color: #f5f7fa;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid #dcdfe6;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-header h2 {
  margin: 0;
  font-size: 1.2em;
}

.session-list {
  border-right: none;
}

.session-list .el-menu-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.main-content {
  padding: 20px;
  height: 100%;
  background-color: #f0f2f5;
}

.terminal-wrapper {
  height: 100%;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.empty-state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style> 