import { ref } from 'vue'

export class WebSocketService {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectTimeout = 1000
  private url: string
  private callbacks: Map<string, (data: any) => void> = new Map()
  private isDev = import.meta.env.DEV

  constructor() {
    this.url = import.meta.env.VITE_WS_URL || 'ws://localhost:8080'
    if (this.isDev) {
      console.log('WebSocket URL:', this.url)
    }
  }

  connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('WebSocket已经连接')
      return Promise.resolve()
    }

    console.log('正在连接到WebSocket服务器...')
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          console.log('WebSocket连接成功')
          this.reconnectAttempts = 0
          resolve()
        }

        this.ws.onclose = () => {
          console.log('WebSocket连接关闭')
          this.ws = null
        }

        this.ws.onerror = (error) => {
          console.error('WebSocket错误:', error)
          reject(error)
        }

        this.ws.onmessage = this.handleMessage.bind(this)
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

  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const message = JSON.stringify(data)
      console.log('发送WebSocket消息:', data)
      this.ws.send(message)
    } else {
      console.error('WebSocket未连接')
    }
  }

  registerCallback(sessionId: string, callback: (data: any) => void) {
    console.log('注册回调:', {
      sessionId,
      existingCallbacks: Array.from(this.callbacks.keys())
    })
    this.callbacks.set(sessionId, callback)
  }

  unregisterCallback(sessionId: string) {
    console.log('注销回调:', {
      sessionId,
      hadCallback: this.callbacks.has(sessionId),
      remainingCallbacks: Array.from(this.callbacks.keys()).filter(id => id !== sessionId)
    })
    this.callbacks.delete(sessionId)
  }

  close() {
    if (this.ws) {
      console.log('关闭WebSocket连接')
      this.ws.close()
      this.ws = null
      this.callbacks.clear()
    }
  }

  private handleMessage(event: MessageEvent) {
    try {
      const message = JSON.parse(event.data)
      console.log('WebSocket收到消息:', {
        type: message.type,
        sessionId: message.sessionId,
        hasCallback: this.callbacks.has(message.sessionId),
        hasWildcard: this.callbacks.has('*'),
        registeredCallbacks: Array.from(this.callbacks.keys())
      })

      // 首先尝试使用通配符回调
      const wildcardCallback = this.callbacks.get('*')
      if (wildcardCallback) {
        console.log('执行通配符回调')
        wildcardCallback(message)
      }

      // 然后尝试使用特定会话的回调
      const callback = this.callbacks.get(message.sessionId)
      if (callback) {
        console.log('执行会话回调:', message.sessionId)
        callback(message)
      } else if (message.sessionId !== 'system') {
        console.log('未找到会话回调，可能是会话尚未完全建立:', message.sessionId)
      }
    } catch (error) {
      console.error('处理WebSocket消息时出错:', error)
    }
  }
}

// 创建单例实例
export const wsService = new WebSocketService() 