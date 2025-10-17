"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Loader2, Send, AlertCircle } from "lucide-react"

interface Message {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  timestamp: Date
  escalated?: boolean
  confidence?: number
}

interface SessionData {
  sessionId: string
  messages: Message[]
  escalated: boolean
  escalationReason?: string
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Initialize session on mount
  useEffect(() => {
    const initSession = async () => {
      try {
        const response = await fetch("/api/sessions/init", {
          method: "POST",
        })
        const data = await response.json()
        setSessionData(data)

        // Add welcome message
        setMessages([
          {
            id: "0",
            role: "assistant",
            content: "Hello! I'm your AI customer support assistant. How can I help you today?",
            timestamp: new Date(),
          },
        ])
      } catch (err) {
        setError("Failed to initialize session")
      }
    }

    initSession()
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading || !sessionData) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionData.sessionId,
          message: input,
          conversationHistory: messages,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to get response")
      }

      const data = await response.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
        escalated: data.escalated,
        confidence: data.confidence,
      }

      setMessages((prev) => [...prev, assistantMessage])

      if (data.escalated) {
        setSessionData((prev) => (prev ? { ...prev, escalated: true, escalationReason: data.escalationReason } : null))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-2xl h-screen md:h-[600px] flex flex-col shadow-lg">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-t-lg">
          <h1 className="text-xl font-bold">Customer Support Assistant</h1>
          <p className="text-sm text-blue-100">AI-powered support with escalation</p>
          {sessionData && <p className="text-xs text-blue-200 mt-1">Session: {sessionData.sessionId.slice(0, 8)}</p>}
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.role === "user"
                      ? "bg-blue-600 text-white rounded-br-none"
                      : "bg-gray-200 text-gray-900 rounded-bl-none"
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs opacity-70">
                      {message.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {message.escalated && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Escalated
                      </Badge>
                    )}
                    {message.confidence !== undefined && message.role === "assistant" && (
                      <Badge variant={message.confidence > 0.7 ? "default" : "secondary"} className="text-xs">
                        {Math.round(message.confidence * 100)}% confident
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-200 text-gray-900 px-4 py-2 rounded-lg rounded-bl-none">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-3 mx-4 mt-2">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Escalation Notice */}
        {sessionData?.escalated && (
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 mx-4 mt-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-600" />
              <div>
                <p className="text-sm font-semibold text-yellow-800">Escalated to Support Team</p>
                <p className="text-xs text-yellow-700">{sessionData.escalationReason}</p>
              </div>
            </div>
          </div>
        )}

        {/* Input Area */}
        <form onSubmit={handleSendMessage} className="border-t p-4 bg-white rounded-b-lg">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question..."
              disabled={loading}
              className="flex-1"
            />
            <Button type="submit" disabled={loading || !input.trim()} className="bg-blue-600 hover:bg-blue-700">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
