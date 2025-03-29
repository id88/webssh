# WebSSH - Web版SSH客户端

基于 Vite + Vue3 + TypeScript 开发的现代化 Web SSH 客户端，提供流畅的终端体验和强大的会话管理功能。

## 功能特性

### SSH连接管理
- [x] 支持密码认证方式
- [x] 基础连接配置
- [x] 会话管理
- [ ] 连接历史记录
- [ ] 配置持久化

### 终端模拟
- [x] 基础终端功能
- [x] 终端大小自适应
- [ ] 复制/粘贴支持
- [ ] 主题配置
- [ ] 快捷键支持

### 多会话管理
- [x] 多会话支持
- [x] 会话切换
- [ ] 分屏功能
- [ ] 会话克隆
- [ ] 会话持久化

## 技术栈

### 前端
- 框架：Vue 3 + TypeScript
- 构建工具：Vite
- 终端模拟：Xterm.js
- 状态管理：Pinia
- UI组件：Element Plus
- 通信：WebSocket

### 后端
- 运行环境：Node.js
- SSH连接：ssh2
- 通信协议：WebSocket

## 快速开始

1. 克隆项目
```bash
git clone <repository-url>
cd webssh
```

2. 安装依赖
```bash
# 安装前端依赖
npm install

# 安装后端依赖
cd server
npm install
cd ..
```

3. 启动服务
```bash
# 启动后端服务
cd server
npm run dev

# 新开终端，启动前端服务
npm run dev
```


## 项目结构

```
webssh/
├── src/                # 前端源码
│   ├── components/     # 组件
│   │   ├── terminal/   # 终端相关组件
│   │   └── connection/ # 连接管理组件
│   ├── stores/         # Pinia 状态管理
│   ├── types/          # TypeScript 类型定义
│   ├── utils/          # 工具函数
│   └── views/          # 页面视图
├── server/             # 后端服务
│   ├── src/            # 后端源码
│   │   ├── services/   # 服务实现
│   │   └── types/      # 类型定义
│   └── package.json    # 后端依赖
└── package.json        # 前端依赖
```

## 使用指南

### 连接到服务器
1. 在主界面点击"新建连接"按钮
2. 填写服务器信息：
   - 主机地址（IP或域名）
   - SSH端口（默认22）
   - 用户名
   - 密码
3. 点击"连接"按钮开始会话

### 会话操作
- 可以同时打开多个SSH会话
- 通过标签切换不同的会话
- 点击关闭按钮断开会话

## 开发计划

请查看 [TODO.md](./TODO.md) 了解详细的开发计划和进度。

## 已知问题

1. 终端复制/粘贴功能尚未实现
2. 会话状态持久化待开发
3. 分屏布局功能待实现
4. 安全性措施需要加强
5. 错误提示需要优化
6. 连接状态显示待完善

## 贡献指南

欢迎提交 Issue 和 Pull Request 来帮助改进项目。

## 许可证

MIT License
