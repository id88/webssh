import { Client } from 'ssh2'
import { EventEmitter } from 'events'
import { SSHConfig } from '../types'

// 定义SSH错误类型
interface SSHError extends Error {
  level?: string
  code?: string
}

export class SSHService extends EventEmitter {
  private client: Client
  private config: SSHConfig
  private stream: any
  private isConnected: boolean = false
  private isDev = process.env.NODE_ENV === 'development'
  private connectTimeout: NodeJS.Timeout | null = null
  private readonly CONNECT_TIMEOUT = 15000 // 增加到15秒
  private readonly HANDSHAKE_TIMEOUT = 10000 // SSH握手超时时间

  constructor(config: SSHConfig) {
    super()
    this.config = config
    this.client = new Client()
    this.setupClientEvents()
  }

  private setupClientEvents() {
    this.client
      .on('handshake', (negotiated) => {
        if (this.isDev) {
          console.log('SSH握手完成:', {
            host: this.config.host,
            username: this.config.username
          })
        }
      })
      .on('ready', () => {
        if (this.isDev) {
          console.log('SSH连接就绪:', {
            host: this.config.host,
            username: this.config.username
          })
        }
        this.isConnected = true
        this.clearConnectTimeout()
        this.emit('ready')
      })
      .on('error', (err: SSHError) => {
        console.error('SSH错误:', {
          message: err.message,
          level: err.level,
          code: err.code,
          host: this.config.host
        })
        this.isConnected = false
        this.clearConnectTimeout()
        
        // 处理特定的错误类型
        if (err.level === 'client-authentication') {
          this.emit('error', new Error('SSH认证失败：用户名或密码错误'))
        } else if (err.level === 'client-timeout') {
          this.emit('error', new Error('SSH连接超时：请检查网络连接和防火墙设置'))
        } else if (err.code === 'ECONNREFUSED') {
          this.emit('error', new Error('SSH连接被拒绝：请检查主机地址和端口'))
        } else {
          this.emit('error', err)
        }
      })
      .once('close', () => {
        if (this.isDev) {
          console.log('SSH连接关闭:', {
            host: this.config.host
          })
        }
        this.isConnected = false
        this.clearConnectTimeout()
        this.emit('close')
      })
      .on('end', () => {
        if (this.isDev) {
          console.log('SSH连接结束:', {
            host: this.config.host
          })
        }
        this.isConnected = false
        this.clearConnectTimeout()
        this.emit('end')
      })
  }

  private clearConnectTimeout() {
    if (this.connectTimeout) {
      clearTimeout(this.connectTimeout)
      this.connectTimeout = null
    }
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // 设置连接超时
      this.connectTimeout = setTimeout(() => {
        const error = new Error('SSH连接超时：服务器无响应')
        console.error('SSH连接超时:', {
          host: this.config.host,
          timeout: this.CONNECT_TIMEOUT
        })
        this.client.end()
        reject(error)
      }, this.CONNECT_TIMEOUT)

      try {
        if (this.isDev) {
          console.log('开始SSH连接:', {
            host: this.config.host,
            username: this.config.username
          })
        }

        this.client.connect({
          host: this.config.host,
          port: this.config.port,
          username: this.config.username,
          password: this.config.password,
          readyTimeout: this.HANDSHAKE_TIMEOUT,
          debug: this.isDev ? (debug: string) => {
            console.log('SSH Debug:', {
              message: debug,
              host: this.config.host
            })
          } : undefined
        })

        this.client.once('ready', () => {
          resolve()
        })

        this.client.once('error', (err) => {
          this.clearConnectTimeout()
          reject(err)
        })
      } catch (error) {
        this.clearConnectTimeout()
        reject(error)
      }
    })
  }

  shell(options: { rows: number; cols: number }): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('SSH未连接'))
        return
      }

      this.client.shell({
        term: 'xterm-256color',
        ...options
      }, (err, stream) => {
        if (err) {
          console.error('打开Shell失败:', err)
          reject(err)
          return
        }

        this.stream = stream
        stream
          .on('data', (data: Buffer) => {
            this.emit('data', data)
          })
          .on('close', () => {
            this.emit('stream:close')
          })
          .on('error', (error: Error) => {
            console.error('Shell流错误:', error)
            this.emit('stream:error', error)
          })

        resolve()
      })
    })
  }

  write(data: string) {
    if (this.stream && !this.stream.destroyed) {
      try {
        this.stream.write(data)
      } catch (error) {
        console.error('写入数据失败:', error)
        this.emit('error', error)
      }
    }
  }

  resize(rows: number, cols: number) {
    if (this.stream && !this.stream.destroyed) {
      try {
        this.stream.setWindow(rows, cols)
      } catch (error) {
        console.error('调整终端大小失败:', error)
      }
    }
  }

  disconnect() {
    if (this.stream && !this.stream.destroyed) {
      this.stream.end()
    }
    if (this.isConnected) {
      this.client.end()
    }
  }
} 