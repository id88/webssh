import { WebSocketServer, WebSocket } from 'ws'
import { SSHService } from './ssh'
import { SSHConfig } from '../types'
import { v4 as uuidv4 } from 'uuid'

interface Session {
  ws: WebSocket
  ssh: SSHService
}

export class WebSocketService {
  private wss: WebSocketServer
  private sessions: Map<string, Session> = new Map()
  private isDev = process.env.NODE_ENV === 'development'

  constructor(port: number) {
    this.wss = new WebSocketServer({ port })
    this.setupWSServer()
  }

  private setupWSServer() {
    this.wss.on('listening', () => {
      console.log('WebSocket服务器运行在端口', this.wss.options.port)
    })

    this.wss.on('error', (error) => {
      console.error('WebSocket服务器错误:', error)
    })

    this.wss.on('connection', (ws: WebSocket, req: any) => {
      if (this.isDev) {
        console.log(`新的WebSocket连接 (${req.socket.remoteAddress})`)
      }

      ws.on('message', async (message: string) => {
        try {
          const data = JSON.parse(message.toString())
          await this.handleMessage(ws, data)
        } catch (error) {
          console.error('处理消息时出错:', error)
          this.sendError(ws, error instanceof Error ? error.message : '消息格式错误')
        }
      })

      ws.on('close', () => {
        this.cleanupSessions(ws)
      })

      ws.on('error', (error) => {
        console.error('WebSocket连接错误:', error)
        this.cleanupSessions(ws)
      })

      this.sendData(ws, 'system', '已连接到WebSSH服务器')
    })
  }

  private async handleMessage(ws: WebSocket, data: any) {
    switch (data.type) {
      case 'create':
        await this.handleCreate(ws, data.config)
        break
      case 'data':
        this.handleData(data.sessionId, data.content)
        break
      case 'resize':
        this.handleResize(data.sessionId, data.rows, data.cols)
        break
      case 'disconnect':
        this.handleDisconnect(data.sessionId)
        break
      default:
        this.sendError(ws, '未知的消息类型')
    }
  }

  private async handleCreate(ws: WebSocket, config: SSHConfig) {
    try {
      const sessionId = uuidv4()
      const ssh = new SSHService(config)

      ssh.on('data', (data: Buffer) => {
        this.sendData(ws, sessionId, data.toString('utf8'))
      })

      await ssh.connect()
      await ssh.shell({ rows: 24, cols: 80 })

      this.sessions.set(sessionId, { ws, ssh })
      this.sendData(ws, 'system', { type: 'created', sessionId })
    } catch (error) {
      console.error('创建SSH会话失败:', error)
      this.sendError(ws, error instanceof Error ? error.message : '创建会话失败')
    }
  }

  private handleData(sessionId: string, content: string) {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.ssh.write(content)
    }
  }

  private handleResize(sessionId: string, rows: number, cols: number) {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.ssh.resize(rows, cols)
    }
  }

  private handleDisconnect(sessionId: string) {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.ssh.disconnect()
      this.sessions.delete(sessionId)
    }
  }

  private cleanupSessions(ws: WebSocket) {
    for (const [sessionId, session] of this.sessions) {
      if (session.ws === ws) {
        this.handleDisconnect(sessionId)
      }
    }
  }

  private sendData(ws: WebSocket, sessionId: string, data: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'data', sessionId, data }))
    }
  }

  private sendError(ws: WebSocket, message: string) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'error', message }))
    }
  }
} 