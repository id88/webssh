import { ref } from 'vue'

export class WebSocketService {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectTimeout = 1000
  private url: string
  private messageCallbacks: Map<string, (data: any) => void> = new Map()
  private isDev = import.meta.env.DEV

  constructor() {
    this.url = import.meta.env.VITE_WS_URL || 'ws://localhost:8080'
    if (this.isDev) {
      console.log('WebSocket URL:', this.url)
    }
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (this.ws?.readyState === WebSocket.OPEN) {
          resolve()
          return
        }

        console.log('正在连接到WebSocket服务器...')
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          console.log('WebSocket连接成功')
          this.reconnectAttempts = 0
          resolve()
        }

        this.ws.onclose = (event) => {
          console.log('WebSocket连接关闭:', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean
          })
          this.handleReconnect()
        }

        this.ws.onerror = (error) => {
          console.error('WebSocket错误:', error)
          reject(error)
        }

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            if (this.isDev) {
              console.debug('收到WebSocket消息:', message)
            }

            // 处理系统消息
            if (message.sessionId === 'system') {
              const callback = this.messageCallbacks.get('system')
              if (callback) {
                callback(message.data || message)
              }
              return
            }

            // 处理错误消息
            if (message.type === 'error') {
              console.error('服务器错误:', message.message)
              const sessionCallback = this.messageCallbacks.get(message.sessionId)
              if (sessionCallback) {
                sessionCallback(message)
              } else {
                // 如果没有找到对应的会话回调，通知所有回调
                this.messageCallbacks.forEach(callback => {
                  callback({ type: 'error', message: message.message })
                })
              }
              return
            }

            // 处理会话消息
            const callback = this.messageCallbacks.get(message.sessionId)
            if (callback) {
              callback(message)
            } else if (this.isDev) {
              console.debug('未找到会话回调，可能是会话尚未完全建立:', message.sessionId)
            }
          } catch (error) {
            console.error('处理消息时出错:', error, '原始消息:', event.data)
          }
        }
      } catch (error) {
        console.error('创建WebSocket连接失败:', error)
        reject(error)
      }
    })
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      console.log(`准备第 ${this.reconnectAttempts} 次重连...`)
      
      setTimeout(() => {
        console.log(`执行第 ${this.reconnectAttempts} 次重连`)
        this.connect().catch(() => {
          if (this.isDev) {
            console.warn(`WebSocket重连失败 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
          }
        })
      }, this.reconnectTimeout * this.reconnectAttempts)
    } else {
      console.warn('达到最大重连次数，停止重连')
    }
  }

  send(message: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket未连接')
    }

    try {
      const data = JSON.stringify(message)
      if (this.isDev) {
        console.debug('发送WebSocket消息:', message)
      }
      this.ws.send(data)
    } catch (error) {
      console.error('发送消息失败:', error)
      throw error
    }
  }

  registerCallback(sessionId: string, callback: (data: any) => void) {
    if (this.isDev) {
      console.log('注册会话回调:', sessionId)
    }
    this.messageCallbacks.set(sessionId, callback)
  }

  unregisterCallback(sessionId: string) {
    if (this.isDev) {
      console.log('注销会话回调:', sessionId)
    }
    this.messageCallbacks.delete(sessionId)
  }

  close() {
    if (this.ws) {
      console.log('关闭WebSocket连接')
      this.ws.close()
      this.ws = null
      this.messageCallbacks.clear()
    }
  }
}

// 创建单例实例
export const wsService = new WebSocketService() 