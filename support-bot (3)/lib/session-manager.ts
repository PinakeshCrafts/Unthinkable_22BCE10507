import { v4 as uuidv4 } from "uuid"

export interface Session {
  sessionId: string
  createdAt: Date
  messages: Array<{
    role: "user" | "assistant"
    content: string
    timestamp: Date
  }>
  escalated: boolean
  escalationReason?: string
  metadata: {
    userAgent?: string
    ipAddress?: string
  }
}

// In-memory session store (replace with database in production)
const sessionStore = new Map<string, Session>()

export function createSession(): Session {
  const sessionId = uuidv4()
  const session: Session = {
    sessionId,
    createdAt: new Date(),
    messages: [],
    escalated: false,
    metadata: {},
  }

  sessionStore.set(sessionId, session)
  return session
}

export function getSession(sessionId: string): Session | undefined {
  return sessionStore.get(sessionId)
}

export function updateSession(sessionId: string, updates: Partial<Session>): Session | undefined {
  const session = sessionStore.get(sessionId)
  if (!session) return undefined

  const updated = { ...session, ...updates }
  sessionStore.set(sessionId, updated)
  return updated
}

export function addMessage(sessionId: string, role: "user" | "assistant", content: string): void {
  const session = sessionStore.get(sessionId)
  if (!session) return

  session.messages.push({
    role,
    content,
    timestamp: new Date(),
  })
}

export function getAllSessions(): Session[] {
  return Array.from(sessionStore.values())
}

export function getSessionMetrics() {
  const sessions = Array.from(sessionStore.values())
  const escalatedCount = sessions.filter((s) => s.escalated).length

  return {
    totalSessions: sessions.length,
    escalatedSessions: escalatedCount,
    escalationRate: sessions.length > 0 ? escalatedCount / sessions.length : 0,
    averageMessagesPerSession:
      sessions.length > 0 ? sessions.reduce((sum, s) => sum + s.messages.length, 0) / sessions.length : 0,
  }
}
