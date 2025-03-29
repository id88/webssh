import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { SSHSession, SSHConfig, LayoutConfig } from '../types/ssh';
import { ConnectionStatus } from '../types/ssh';
import { v4 as uuidv4 } from 'uuid';

export const useSSHStore = defineStore('ssh', () => {
  // 状态
  const sessions = ref<Map<string, SSHSession>>(new Map());
  const layout = ref<LayoutConfig>({
    type: 'tabs',
    sessions: [],
  });

  // 计算属性
  const activeSessions = computed(() => 
    Array.from(sessions.value.values()).filter(
      session => session.status === ConnectionStatus.CONNECTED
    )
  );

  const activeSession = computed(() => 
    layout.value.activeSession ? sessions.value.get(layout.value.activeSession) : undefined
  );

  // 方法
  function createSession(config: SSHConfig, title?: string): SSHSession {
    const id = uuidv4();
    const session: SSHSession = {
      id,
      config,
      status: ConnectionStatus.DISCONNECTED,
      title: title || `${config.username}@${config.host}:${config.port}`,
      createdAt: new Date(),
      lastActive: new Date(),
    };

    sessions.value.set(id, session);
    layout.value.sessions.push(id);
    layout.value.activeSession = id;

    return session;
  }

  function updateSessionStatus(id: string, status: ConnectionStatus) {
    const session = sessions.value.get(id);
    if (session) {
      session.status = status;
      session.lastActive = new Date();
    }
  }

  function removeSession(id: string) {
    sessions.value.delete(id);
    layout.value.sessions = layout.value.sessions.filter(sessionId => sessionId !== id);
    
    if (layout.value.activeSession === id) {
      layout.value.activeSession = layout.value.sessions[0];
    }
  }

  function setActiveSession(id: string) {
    if (sessions.value.has(id)) {
      layout.value.activeSession = id;
    }
  }

  function updateLayout(newLayout: Partial<LayoutConfig>) {
    layout.value = { ...layout.value, ...newLayout };
  }

  return {
    sessions,
    layout,
    activeSessions,
    activeSession,
    createSession,
    updateSessionStatus,
    removeSession,
    setActiveSession,
    updateLayout,
  };
}); 