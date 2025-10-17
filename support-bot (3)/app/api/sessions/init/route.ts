import { connectDB } from "@/lib/mongodb"
import { Session } from "@/lib/models/session"
import { getServerSession } from "next-auth/next"

export async function POST(req: Request) {
  try {
    await connectDB()

    const session = await getServerSession()

    if (!session?.user?.email) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const newSession = await Session.create({
      userId: session.user.id,
      messages: [],
      escalated: false,
      metadata: {
        userAgent: req.headers.get("user-agent") || undefined,
      },
    })

    return Response.json({
      sessionId: newSession._id,
      createdAt: newSession.createdAt,
      messages: newSession.messages,
      escalated: newSession.escalated,
    })
  } catch (error) {
    console.error("Session init error:", error)
    return Response.json({ error: "Failed to create session" }, { status: 500 })
  }
}
