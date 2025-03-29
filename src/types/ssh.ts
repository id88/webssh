// SSH连接配置接口
export interface SSHConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  timeout?: number;
}

// SSH连接状态枚举
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error'
}

// SSH会话接口
export interface SSHSession {
  id: string;
  config: SSHConfig;
  status: ConnectionStatus;
  title: string;
  createdAt: Date;
  lastActive: Date;
}

// 终端配置接口
export interface TerminalConfig {
  fontSize: number;
  fontFamily: string;
  theme: {
    background: string;
    foreground: string;
    cursor: string;
    selection: string;
    black: string;
    red: string;
    green: string;
    yellow: string;
    blue: string;
    magenta: string;
    cyan: string;
    white: string;
    brightBlack: string;
    brightRed: string;
    brightGreen: string;
    brightYellow: string;
    brightBlue: string;
    brightMagenta: string;
    brightCyan: string;
    brightWhite: string;
  };
}

// 会话布局类型
export type LayoutType = 'tabs' | 'split-horizontal' | 'split-vertical';

// 布局配置接口
export interface LayoutConfig {
  type: LayoutType;
  sessions: string[]; // 会话ID数组
  activeSession?: string;
} 