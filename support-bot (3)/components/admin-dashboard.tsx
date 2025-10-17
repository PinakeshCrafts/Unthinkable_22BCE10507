"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { AlertCircle, MessageSquare, Users, TrendingUp } from "lucide-react"

interface SessionMetrics {
  totalSessions: number
  escalatedSessions: number
  averageResponseTime: number
  averageConfidence: number
}

export function AdminDashboard() {
  const [metrics, setMetrics] = useState<SessionMetrics>({
    totalSessions: 0,
    escalatedSessions: 0,
    averageResponseTime: 0,
    averageConfidence: 0,
  })

  useEffect(() => {
    // Fetch metrics from API
    const fetchMetrics = async () => {
      try {
        const response = await fetch("/api/metrics")
        const data = await response.json()
        setMetrics(data)
      } catch (error) {
        console.error("Failed to fetch metrics:", error)
      }
    }

    fetchMetrics()
    const interval = setInterval(fetchMetrics, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Total Sessions</p>
            <p className="text-2xl font-bold">{metrics.totalSessions}</p>
          </div>
          <Users className="w-8 h-8 text-blue-500" />
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Escalated</p>
            <p className="text-2xl font-bold">{metrics.escalatedSessions}</p>
          </div>
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Avg Response Time</p>
            <p className="text-2xl font-bold">{metrics.averageResponseTime}ms</p>
          </div>
          <MessageSquare className="w-8 h-8 text-green-500" />
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Avg Confidence</p>
            <p className="text-2xl font-bold">{Math.round(metrics.averageConfidence * 100)}%</p>
          </div>
          <TrendingUp className="w-8 h-8 text-purple-500" />
        </div>
      </Card>
    </div>
  )
}
