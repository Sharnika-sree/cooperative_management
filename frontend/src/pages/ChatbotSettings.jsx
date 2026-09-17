import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import { MessageSquare, Send, Sparkles, User, Bot, AlertCircle } from 'lucide-react'

const ChatbotSettings = () => {
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      content: 'Hello! I am your Cooperative AI Assistant. Ask me anything about government schemes, fertilizer availability, seed requests, or cooperative services!'
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef(null)

  const suggestions = [
    { label: '🌾 Government Schemes', question: 'Which government schemes am I eligible for?' },
    { label: '📦 Fertilizer Availability', question: 'Is urea available?' },
    { label: '📝 My Requests', question: 'What is my request status?' },
    { label: '🏢 Cooperative Services', question: 'What services does the cooperative provide?' }
  ]

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSend = async (messageText) => {
    const textToSend = messageText || input
    if (!textToSend.trim()) return

    setError('')
    const userMessage = { role: 'user', content: textToSend }
    setMessages(prev => [...prev, userMessage])
    if (!messageText) setInput('')
    setLoading(true)

    try {
      const response = await axios.post('/api/chatbot', { message: textToSend })
      setMessages(prev => [...prev, { role: 'bot', content: response.data.response }])
    } catch (err) {
      console.error(err)
      setMessages(prev => [...prev, { role: 'bot', content: 'Sorry, I am having trouble connecting right now. Please try again in a moment.' }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Clean AI Header */}
      <div className="page-header flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Bot className="w-6 h-6 mr-2 text-primary-600" />
            AI Assistant
          </h1>
          <p className="text-sm text-gray-500 mt-1">Ask questions about society services, schemes eligibility, or item availability.</p>
        </div>
        <div className="flex items-center space-x-1 bg-yellow-50 border border-yellow-100 text-yellow-750 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm">
          <Sparkles className="w-3.5 h-3.5 mr-1 text-yellow-500 animate-pulse" />
          NLP Ready
        </div>
      </div>

      {/* Main Chat Interface Container */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[600px] overflow-hidden">
        {/* Messages Screen */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
          {messages.map((msg, index) => {
            const isUser = msg.role === 'user'
            return (
              <div key={index} className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                <div className={`flex items-start space-x-2.5 max-w-[85%] ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <div className={`p-2 rounded-xl border shrink-0 ${
                    isUser ? 'bg-primary-50 border-primary-200 text-primary-700' : 'bg-white border-gray-200 text-gray-700'
                  }`}>
                    {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-primary-655" />}
                  </div>
                  <div className={`p-4 rounded-2xl leading-relaxed text-sm ${
                    isUser 
                      ? 'bg-primary-600 text-white rounded-tr-none font-medium' 
                      : 'bg-white text-gray-800 border border-gray-150 rounded-tl-none shadow-sm'
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              </div>
            )
          })}
          {loading && (
            <div className="flex justify-start">
              <div className="flex items-start space-x-2.5 max-w-[80%]">
                <div className="p-2 rounded-xl border bg-white border-gray-200 text-gray-700">
                  <Bot className="w-4 h-4 text-primary-655 animate-spin" />
                </div>
                <div className="bg-white border border-gray-150 p-4 rounded-2xl rounded-tl-none shadow-sm">
                  <div className="flex space-x-1.5 py-1">
                    <div className="w-2.5 h-2.5 bg-primary-400 rounded-full animate-bounce"></div>
                    <div className="w-2.5 h-2.5 bg-primary-400 rounded-full animate-bounce delay-100"></div>
                    <div className="w-2.5 h-2.5 bg-primary-400 rounded-full animate-bounce delay-200"></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Questions Grid */}
        <div className="p-4 bg-white border-t border-gray-100 space-y-2">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-extrabold px-1">Suggested Questions</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {suggestions.map((sug, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(sug.question)}
                disabled={loading}
                className="p-2.5 bg-gray-50 border border-gray-200 hover:bg-primary-50 hover:border-primary-300 rounded-xl text-left text-xs font-bold text-gray-700 hover:text-primary-700 transition-all shadow-sm shrink-0"
              >
                {sug.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input Panel */}
        <div className="p-4 bg-white border-t border-gray-100 flex items-center space-x-3 shrink-0">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a question..."
            className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none text-sm transition-all bg-gray-50/50"
            disabled={loading}
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="bg-primary-600 text-white p-3 rounded-xl hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChatbotSettings
