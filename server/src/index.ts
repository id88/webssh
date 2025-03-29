import express from 'express'
import cors from 'cors'
import { WebSocketService } from './services/websocket'
import * as dotenv from 'dotenv'
import { createServer } from 'http'
import path from 'path'

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../.env') })

// 创建 Express 应用
const app = express()
const port = process.env.PORT || 3000
const wsPort = process.env.WS_PORT || 8080

console.log('启动服务器...')
console.log('当前目录:', __dirname)
console.log('环境变量文件路径:', path.resolve(__dirname, '../.env'))
console.log('环境变量:', {
  PORT: process.env.PORT,
  WS_PORT: process.env.WS_PORT
})

// 中间件
app.use(cors())
app.use(express.json())

// 错误处理中间件
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Express错误:', err)
  res.status(500).json({ error: '服务器内部错误' })
})

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 创建 HTTP 服务器
const server = createServer(app)

// 启动 HTTP 服务器
server.listen(port, () => {
  console.log(`HTTP服务器运行在端口 ${port}`)
}).on('error', (error) => {
  console.error('HTTP服务器启动失败:', error)
})

// 启动 WebSocket 服务器
try {
  const wsServer = new WebSocketService(Number(wsPort))
  console.log(`WebSocket服务器运行在端口 ${wsPort}`)

  // 监听进程退出事件
  process.on('SIGINT', () => {
    console.log('正在关闭服务器...')
    server.close(() => {
      console.log('HTTP服务器已关闭')
      process.exit(0)
    })
  })
} catch (error) {
  console.error('WebSocket服务器启动失败:', error)
  process.exit(1)
} 