import { generateText } from "ai"
import { connectDB } from "@/lib/mongodb"
import { Session } from "@/lib/models/session"

const FAQ_DATABASE = [
  {
    id: 1,
    question: "What are your business hours?",
    answer: "We are open Monday to Friday, 9 AM to 6 PM EST. We are closed on weekends and holidays.",
    category: "general",
  },
  {
    id: 2,
    question: "How do I reset my password?",
    answer:
      'To reset your password: 1) Click "Forgot Password" on the login page, 2) Enter your email, 3) Check your email for a reset link, 4) Click the link and create a new password.',
    category: "account",
  },
  {
    id: 3,
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit cards (Visa, Mastercard, American Express), PayPal, and bank transfers for enterprise customers.",
    category: "billing",
  },
  {
    id: 4,
    question: "How long does shipping take?",
    answer:
      "Standard shipping takes 5-7 business days. Express shipping takes 2-3 business days. International orders may take 10-15 business days.",
    category: "shipping",
  },
  {
    id: 5,
    question: "What is your return policy?",
    answer:
      "We offer a 30-day money-back guarantee on all products. Items must be in original condition with all packaging.",
    category: "returns",
  },
  {
    id: 6,
    question: "How do I contact support?",
    answer:
      "You can reach our support team via email at support@company.com, phone at 1-800-SUPPORT, or through this chat interface.",
    category: "support",
  },
  {
    id: 7,
    question: "Do you offer discounts for bulk orders?",
    answer:
      "Yes! We offer volume discounts starting at 10+ units. Contact our sales team at sales@company.com for a custom quote.",
    category: "billing",
  },
  {
    id: 8,
    question: "Is my data secure?",
    answer:
      "Yes, we use industry-standard encryption (SSL/TLS) and comply with GDPR and CCPA regulations. Your data is never shared with third parties.",
    category: "security",
  },
]

// System prompt for the AI
const SYSTEM_PROMPT = `You are a helpful customer support AI assistant. Your role is to:
1. Answer customer questions based on the provided FAQ database
2. Be friendly, professional, and concise
3. If you cannot find an answer in the FAQ, acknowledge this and suggest escalation
4. Maintain context from the conversation history
5. Provide accurate information only

When responding:
- If the answer is in the FAQ, provide it directly
- If the question is unclear, ask for clarification
- If the issue requires human intervention, indicate this clearly
- Always be empathetic and helpful`

interface ChatRequest {
  sessionId: string
  message: string
  conversationHistory: Array<{
    role: "user" | "assistant"
    content: string
  }>
}

interface EscalationResponse {
  shouldEscalate: boolean
  confidence: number
  reason: string
}

async function checkEscalation(
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>,
): Promise<EscalationResponse> {
  const escalationPrompt = `Based on this customer support conversation, determine if the issue should be escalated to a human agent.

Escalate if:
- The customer is frustrated or angry
- The issue is complex and requires human judgment
- The question is outside the FAQ scope
- The customer explicitly requests a human agent
- Multiple failed attempts to resolve

Customer message: "${userMessage}"

Respond with JSON: { "shouldEscalate": boolean, "confidence": number (0-1), "reason": string }`

  try {
    const { text } = await generateText({
      model: "google/gemini-1.5-flash",
      prompt: escalationPrompt,
      maxOutputTokens: 200,
    })

    const parsed = JSON.parse(text)
    return {
      shouldEscalate: parsed.shouldEscalate || false,
      confidence: parsed.confidence || 0.5,
      reason: parsed.reason || "Escalation needed",
    }
  } catch {
    return {
      shouldEscalate: false,
      confidence: 0.5,
      reason: "Unable to determine escalation",
    }
  }
}

async function generateResponse(
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>,
): Promise<{ response: string; confidence: number }> {
  const faqContext = FAQ_DATABASE.map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`).join("\n\n")

  const prompt = `${SYSTEM_PROMPT}

FAQ Database:
${faqContext}

Conversation History:
${conversationHistory.map((msg) => `${msg.role}: ${msg.content}`).join("\n")}

Customer: ${userMessage}

Provide a helpful response. If you're confident in your answer based on the FAQ, respond directly. If not, suggest escalation.`

  try {
    const { text } = await generateText({
      model: "google/gemini-1.5-flash",
      prompt,
      maxOutputTokens: 500,
      temperature: 0.7,
    })

    // Estimate confidence based on response characteristics
    const confidence = text.toLowerCase().includes("escalat") ? 0.4 : 0.85

    return {
      response: text,
      confidence,
    }
  } catch (error) {
    return {
      response:
        "I apologize, but I encountered an error processing your request. Please try again or contact our support team.",
      confidence: 0.3,
    }
  }
}

export async function POST(req: Request) {
  try {
    await connectDB()

    const body: ChatRequest = await req.json()
    const { sessionId, message, conversationHistory } = body

    if (!message.trim()) {
      return Response.json({ error: "Message cannot be empty" }, { status: 400 })
    }

    const session = await Session.findByIdAndUpdate(
      sessionId,
      {
        $push: {
          messages: {
            role: "user",
            content: message,
            timestamp: new Date(),
          },
        },
      },
      { new: true },
    )

    if (!session) {
      return Response.json({ error: "Session not found" }, { status: 404 })
    }

    // Check for escalation
    const escalationCheck = await checkEscalation(message, conversationHistory)

    if (escalationCheck.shouldEscalate) {
      await Session.findByIdAndUpdate(sessionId, {
        escalated: true,
        escalationReason: escalationCheck.reason,
      })

      return Response.json({
        response: `I understand this requires special attention. I'm escalating your case to our support team. They will contact you shortly at your registered email. Your session ID is: ${sessionId}`,
        escalated: true,
        escalationReason: escalationCheck.reason,
        confidence: escalationCheck.confidence,
      })
    }

    // Generate AI response
    const { response, confidence } = await generateResponse(message, conversationHistory)

    await Session.findByIdAndUpdate(sessionId, {
      $push: {
        messages: {
          role: "assistant",
          content: response,
          timestamp: new Date(),
        },
      },
    })

    return Response.json({
      response,
      escalated: false,
      confidence,
      sessionId,
    })
  } catch (error) {
    console.error("Chat API error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
