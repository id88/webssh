import { ref } from 'vue'

export class WebSocketService {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectTimeout = 1000
  private url: string
  private callbacks: Map<string, (data: any) => void> = new Map()
  private isDev = import.meta.env.DEV
  private _isConnected = false

  constructor() {
    this.url = import.meta.env.VITE_WS_URL || 'ws://localhost:8080'
    if (this.isDev) {
      console.log('WebSocket URL:', this.url)
    }
  }

  isConnected(): boolean {
    return this._isConnected && this.ws?.readyState === WebSocket.OPEN
  }

  connect(): Promise<void> {
    if (this.isConnected()) {
      console.log('WebSocket已经连接')
      return Promise.resolve()
    }

    console.log('正在连接到WebSocket服务器...')
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          console.log('WebSocket连接成功')
          this._isConnected = true
          this.reconnectAttempts = 0
          resolve()
        }

        this.ws.onclose = () => {
          console.log('WebSocket连接关闭')
          this._isConnected = false
          this.ws = null
          this.handleReconnect()
        }

        this.ws.onerror = (error) => {
          console.error('WebSocket错误:', error)
          this._isConnected = false
          reject(error)
        }

        this.ws.onmessage = this.handleMessage.bind(this)
      } catch (error) {
        console.error('创建WebSocket连接失败:', error)
        this._isConnected = false
        reject(error)
      }
    })
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      if (this.isDev) {
        console.log(`准备第 ${this.reconnectAttempts} 次重连...`, {
          maxAttempts: this.maxReconnectAttempts,
          timeout: this.reconnectTimeout * this.reconnectAttempts
        })
      }
      
      setTimeout(() => {
        if (this.isDev) {
          console.log(`执行第 ${this.reconnectAttempts} 次重连`)
        }
        this.connect().catch((error) => {
          console.error(`WebSocket重连失败 (${this.reconnectAttempts}/${this.maxReconnectAttempts}):`, {
            error
          })
        })
      }, this.reconnectTimeout * this.reconnectAttempts)
    } else {
      console.error('达到最大重连次数，停止重连', {
        attempts: this.reconnectAttempts
      })
      // 通知系统回调
      const systemCallback = this.callbacks.get('system')
      if (systemCallback) {
        systemCallback({
          type: 'error',
          message: 'WebSocket连接已断开，请刷新页面重试',
          sessionId: 'system'
        })
      }
    }
  }

  send(data: any) {
    if (this.isConnected()) {
      if (this.isDev) {
        console.log('发送WebSocket消息:', {
          type: data.type,
          sessionId: data.sessionId
        })
      }
      const message = JSON.stringify(data)
      this.ws!.send(message)
    } else {
      console.error('WebSocket未连接，无法发送消息:', {
        type: data.type,
        sessionId: data.sessionId,
        reconnectAttempts: this.reconnectAttempts
      })
      // 尝试重新连接
      this.connect().catch(error => {
        console.error('重新连接失败:', error)
      })
    }
  }

  registerCallback(sessionId: string, callback: (data: any) => void) {
    if (this.isDev) {
      console.log('注册回调:', {
        sessionId,
        existingCallbacks: Array.from(this.callbacks.keys())
      })
    }
    this.callbacks.set(sessionId, callback)
  }

  unregisterCallback(sessionId: string) {
    if (this.isDev) {
      console.log('注销回调:', {
        sessionId,
        hadCallback: this.callbacks.has(sessionId),
        remainingCallbacks: Array.from(this.callbacks.keys()).filter(id => id !== sessionId)
      })
    }
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
      if (this.isDev) {
        console.log('WebSocket收到消息:', {
          type: message.type,
          sessionId: message.sessionId,
          hasCallback: this.callbacks.has(message.sessionId),
          hasWildcard: this.callbacks.has('*')
        })
      }

      // 检查是否是错误消息
      if (message.type === 'error') {
        console.error('收到错误消息:', {
          message: message.message,
          sessionId: message.sessionId
        })
        
        // 如果是认证相关的错误，不要断开WebSocket连接
        if (message.message?.toLowerCase().includes('auth') || 
            message.message?.toLowerCase().includes('password') ||
            message.message?.toLowerCase().includes('authentication')) {
          console.log('SSH认证失败，保持WebSocket连接')
          // 触发错误回调但保持连接
          const callback = this.callbacks.get('system')
          if (callback) {
            callback(message)
          }
          return
        }
      }

      // 首先尝试使用通配符回调
      const wildcardCallback = this.callbacks.get('*')
      if (wildcardCallback) {
        if (this.isDev) {
          console.log('执行通配符回调')
        }
        wildcardCallback(message)
      }

      // 然后尝试使用特定会话的回调
      const callback = this.callbacks.get(message.sessionId)
      if (callback) {
        if (this.isDev) {
          console.log('执行会话回调:', message.sessionId)
        }
        callback(message)
      } else if (message.sessionId !== 'system') {
        if (this.isDev) {
          console.log('未找到会话回调，可能是会话尚未完全建立:', message.sessionId)
        }
      }
    } catch (error) {
      console.error('处理WebSocket消息时出错:', {
        error,
        wsState: this.isConnected()
      })
    }
  }
}

// 创建单例实例
export const wsService = new WebSocketService() 