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
import { ref, computed, watch, nextTick } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import Terminal from '@/components/terminal/Terminal.vue'
import ConnectionForm from '@/components/connection/ConnectionForm.vue'
import { wsService } from '@/services/websocket'
import { ElMessage } from 'element-plus'

// 状态
const sessions = ref<Array<{ id: string; title: string; buffer: string[] }>>([])
const activeSessionId = ref<string>('')
const showConnectionDialog = ref(false)
const terminalRef = ref()

// 计算属性
const activeSession = computed(() => 
  sessions.value.find(s => s.id === activeSessionId.value)
)

// 监听会话切换
watch(activeSessionId, (newId, oldId) => {
  console.log('会话切换:', { oldId, newId })
  if (newId && activeSession.value) {
    // 恢复会话内容
    const session = activeSession.value
    console.log('当前会话信息:', {
      id: session.id,
      title: session.title,
      bufferLength: session.buffer.length
    })
    // 总是清空终端内容
    nextTick(() => {
      console.log('清空终端内容')
      terminalRef.value?.clear()
      if (session.buffer.length > 0) {
        console.log('准备恢复会话内容:', session.id)
        session.buffer.forEach((content, index) => {
          console.log(`写入内容 [${index}]:`, content.length > 50 ? content.substring(0, 50) + '...' : content)
          terminalRef.value?.write(content)
        })
      }
    })
  }
})

// 连接处理
const handleConnect = async (config: {
  host: string
  port: number
  username: string
  password: string
}) => {
  try {
    console.log('开始创建新的SSH会话')

    // 检查WebSocket连接状态
    if (!wsService.isConnected()) {
      console.log('WebSocket未连接，尝试重新连接')
      await wsService.connect()
    }

    // 创建新的SSH会话
    const sessionId = uuidv4()
    const title = `${config.username}@${config.host}:${config.port}`
    let serverSessionId = ''
    const messageBuffer: any[] = [] // 用于缓存早期消息
    let isAuthError = false // 标记是否是认证错误
    
    // 创建一个Promise来等待会话创建
    const sessionCreated = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup(true)
        console.error('会话创建超时，可能原因：', {
          wsConnected: wsService.isConnected(),
          hasServerResponse: !!serverSessionId,
          bufferedMessages: messageBuffer.length,
          isAuthError
        })
        reject(new Error('会话创建超时'))
      }, 30000) // 30秒超时

      const cleanup = (removeServerCallback = false) => {
        console.log('执行清理操作:', {
          removeServerCallback,
          serverSessionId,
          wsConnected: wsService.isConnected(),
          timestamp: new Date().toISOString(),
          isAuthError
        })
        clearTimeout(timeout)
        // 按照注册的相反顺序清理回调
        if (removeServerCallback && serverSessionId) {
          wsService.unregisterCallback(serverSessionId)
        }
        wsService.unregisterCallback('*')
        wsService.unregisterCallback(sessionId)
        wsService.unregisterCallback('system')
      }

      // 首先注册通配符回调，确保能捕获所有消息
      console.log('注册通配符回调')
      wsService.registerCallback('*', (message) => {
        console.log('收到WebSocket消息:', {
          type: message.type,
          sessionId: message.sessionId,
          messageType: typeof message.data,
          timestamp: new Date().toISOString(),
          error: message.error,
          errorMessage: message.message
        })

        // 将所有非系统消息都存入缓冲区
        if (message.type === 'data' && message.sessionId !== 'system') {
          messageBuffer.push(message)
        }
      })

      // 然后注册临时回调
      console.log('注册临时回调:', sessionId)
      wsService.registerCallback(sessionId, (message) => {
        console.log('收到临时消息:', {
          type: message.type,
          sessionId: message.sessionId,
          dataLength: message.data?.length || message.content?.length || 0,
          data: message.data || message.content
        })
        if (message.type === 'data') {
          messageBuffer.push(message)
        }
      })

      // 最后注册系统消息回调
      console.log('注册系统消息回调')
      wsService.registerCallback('system', (data) => {
        console.log('收到系统消息:', {
          type: data.type,
          message: data.message,
          timestamp: new Date().toISOString(),
          error: data.error,
          wsConnected: wsService.isConnected()
        })
        
        if (data.type === 'error') {
          console.error('SSH连接错误:', {
            message: data.message,
            wsState: wsService.isConnected(),
            timestamp: new Date().toISOString()
          })

          // 对于认证错误，显示错误消息但保持对话框打开
          if (data.message?.includes('认证失败') || 
              data.message?.includes('authentication') ||
              data.message?.includes('密码错误')) {
            ElMessage.error(data.message)
            cleanup(true)
            reject(new Error(data.message))
            return
          }

          // 其他错误按原有逻辑处理
          cleanup(true)
          reject(new Error(data.message))
        } else if (data.type === 'created' || (data.data && data.data.type === 'created')) {
          // 服务器返回了新的会话ID
          const sessionData = data.data || data
          serverSessionId = sessionData.sessionId
          console.log('服务器分配会话ID:', serverSessionId)
          
          // 更新会话列表中的ID
          const session = { id: serverSessionId, title, buffer: [] }
          sessions.value.push(session)
          console.log('新会话已添加到列表:', {
            id: session.id,
            title: session.title,
            totalSessions: sessions.value.length
          })

          // 切换到新会话
          console.log('切换到新会话:', serverSessionId)
          activeSessionId.value = serverSessionId

          // 注册新的会话回调
          console.log('注册会话回调:', serverSessionId)
          wsService.registerCallback(serverSessionId, (message) => {
            if (message.type === 'data') {
              const content = message.content || message.data
              if (typeof content === 'string') {
                // 写入终端
                if (activeSessionId.value === serverSessionId) {
                  console.log(`写入终端数据 [${serverSessionId}]:`, {
                    length: content.length,
                    preview: content.length > 50 ? content.substring(0, 50) + '...' : content
                  })
                  terminalRef.value?.write(content)
                }
                // 保存到缓冲区
                const session = sessions.value.find(s => s.id === serverSessionId)
                if (session) {
                  session.buffer.push(content)
                  console.log(`更新缓冲区 [${serverSessionId}]:`, {
                    newLength: session.buffer.length,
                    lastMessageLength: content.length
                  })
                }
              }
            } else if (message.type === 'error') {
              console.error('SSH错误:', message.message)
              ElMessage.error(message.message)
            }
          })
          
          // 处理缓存的消息
          console.log('准备处理缓存消息:', {
            bufferSize: messageBuffer.length,
            expectedSessionId: serverSessionId,
            messageSessionIds: messageBuffer.map(m => m.sessionId)
          })

          // 先按时间顺序排序消息
          const sortedMessages = messageBuffer.filter(message => {
            const matches = message.type === 'data' && 
              message.sessionId === serverSessionId &&
              (message.data || message.content)
            
            console.log('过滤消息:', {
              sessionId: message.sessionId,
              matchesSessionId: message.sessionId === serverSessionId,
              hasContent: !!(message.data || message.content),
              isIncluded: matches
            })
            
            return matches
          })

          console.log('过滤后的消息:', {
            originalCount: messageBuffer.length,
            filteredCount: sortedMessages.length,
            sessionIds: sortedMessages.map(m => m.sessionId)
          })

          if (sortedMessages.length > 0) {
            console.log(`开始处理 ${sortedMessages.length} 条消息`)
            sortedMessages.forEach((message, index) => {
              const content = message.content || message.data
              if (typeof content === 'string') {
                console.log(`处理第 ${index + 1} 条消息:`, {
                  sessionId: message.sessionId,
                  contentLength: content.length,
                  contentPreview: content.substring(0, 50)
                })
                
                // 写入终端
                if (activeSessionId.value === serverSessionId) {
                  console.log(`写入终端 [${index + 1}/${sortedMessages.length}]`)
                  terminalRef.value?.write(content)
                }
                
                // 保存到缓冲区
                const session = sessions.value.find(s => s.id === serverSessionId)
                if (session) {
                  session.buffer.push(content)
                  console.log(`更新会话缓冲区 [${index + 1}/${sortedMessages.length}]:`, {
                    sessionId: serverSessionId,
                    newBufferSize: session.buffer.length
                  })
                }
              }
            })
          } else {
            console.log('没有找到匹配的缓存消息:', {
              expectedSessionId: serverSessionId,
              availableSessionIds: [...new Set(messageBuffer.map(m => m.sessionId))]
            })
          }
          
          messageBuffer.length = 0 // 清空缓存
          console.log('缓冲区已清空')
          
          // 只清理临时回调，保留服务器会话回调
          cleanup(false)
          resolve(true)
        }
      })

      // 发送创建会话请求
      console.log('发送创建会话请求:', {
        sessionId,
        host: config.host,
        username: config.username
      })
      wsService.send({
        type: 'create',
        sessionId,
        config
      })
    })

    // 等待会话创建确认
    await sessionCreated
    showConnectionDialog.value = false
  } catch (error) {
    console.error('创建SSH会话时出错:', {
      error,
      wsState: wsService.isConnected()
    })
    ElMessage.error(error instanceof Error ? error.message : '连接失败')
  }
}

// 会话管理
const handleSessionSelect = (sessionId: string) => {
  console.log('手动切换会话:', { from: activeSessionId.value, to: sessionId })
  activeSessionId.value = sessionId
}

const handleCloseSession = (sessionId: string) => {
  console.log('关闭会话:', sessionId)
  // 发送断开连接请求
  wsService.send({
    type: 'disconnect',
    sessionId
  })

  // 注销回调
  wsService.unregisterCallback(sessionId)
  
  // 更新会话列表
  const index = sessions.value.findIndex(s => s.id === sessionId)
  if (index !== -1) {
    sessions.value.splice(index, 1)
    console.log('会话已从列表中移除, 剩余会话:', sessions.value.length)
  }

  // 更新活动会话
  if (activeSessionId.value === sessionId) {
    const newActiveId = sessions.value[0]?.id || ''
    console.log('更新活动会话:', { from: sessionId, to: newActiveId })
    activeSessionId.value = newActiveId
  }
}

// 终端事件处理
const handleTerminalData = (data: string) => {
  if (activeSessionId.value) {
    console.log(`发送终端数据 [${activeSessionId.value}]:`, data.length > 50 ? data.substring(0, 50) + '...' : data)
    wsService.send({
      type: 'data',
      sessionId: activeSessionId.value,
      content: data
    })
  }
}

const handleTerminalResize = (size: { cols: number; rows: number }) => {
  if (activeSessionId.value) {
    // console.log(`调整终端大小 [${activeSessionId.value}]:`, size)
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
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  display: flex;
}

.el-container {
  width: 100%;
  height: 100%;
}

.el-aside {
  height: 100%;
  border-right: 1px solid var(--el-border-color-light);
  background-color: var(--el-bg-color);
  transition: width 0.3s;
  overflow: hidden;
  padding: 0;
}

.sidebar {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--el-border-color-light);
  background-color: var(--el-bg-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.sidebar-header h2 {
  margin: 0;
  font-size: 1.2em;
  color: var(--el-text-color-primary);
}

.el-scrollbar {
  flex: 1;
  height: calc(100% - 53px); /* 减去header高度 */
}

.session-list {
  border: none;
  height: 100%;
}

.session-list .el-menu-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px;
  height: 40px;
  margin: 0;
}

.session-list .el-menu-item span {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 8px;
}

.el-main {
  padding: 0;
  height: 100%;
  background-color: var(--el-bg-color-page);
  position: relative;
  overflow: hidden;
}

.terminal-wrapper {
  height: 100%;
  background-color: #1e1e1e;
  position: relative;
  overflow: hidden;
}

.empty-state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--el-bg-color);
  margin: 0;
}

/* 响应式布局 */
@media screen and (max-width: 768px) {
  .el-aside {
    width: 200px !important;
  }
  
  .sidebar-header h2 {
    font-size: 1em;
  }
  
  .sidebar-header .el-button {
    padding: 6px 10px;
  }
}

/* 暗色主题适配 */
@media (prefers-color-scheme: dark) {
  .terminal-wrapper {
    background-color: #000;
  }
}
</style> 