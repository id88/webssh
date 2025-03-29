import { Client } from 'ssh2'
import { EventEmitter } from 'events'
import { SSHConfig } from '../types'

export class SSHService extends EventEmitter {
  private client: Client
  private config: SSHConfig
  private stream: any
  private isConnected: boolean = false
  private isDev = process.env.NODE_ENV === 'development'

  constructor(config: SSHConfig) {
    super()
    this.config = config
    this.client = new Client()
    this.setupClientEvents()
  }

  private setupClientEvents() {
    this.client
      .on('ready', () => {
        this.isConnected = true
        if (this.isDev) {
          console.log(`SSH连接已就绪 (${this.config.host})`)
        }
      })
      .on('error', (err) => {
        this.isConnected = false
        console.error('SSH连接错误:', err)
        this.emit('error', err)
      })
      .on('close', () => {
        this.isConnected = false
        if (this.isDev) {
          console.log(`SSH连接已关闭 (${this.config.host})`)
        }
      })
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('连接超时'))
        this.client.end()
      }, 10000)

      this.client.on('ready', () => {
        clearTimeout(timeout)
        resolve()
      }).on('error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })

      try {
        this.client.connect({
          ...this.config,
          readyTimeout: 10000,
          keepaliveInterval: 10000
        })
      } catch (error) {
        clearTimeout(timeout)
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