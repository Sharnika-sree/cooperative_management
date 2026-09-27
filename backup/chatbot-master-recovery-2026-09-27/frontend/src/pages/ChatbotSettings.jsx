import { Bot } from 'lucide-react'
import { useChatbot } from '../context/ChatbotContext'
import ChatPanel from '../components/ChatPanel'

const ChatbotSettings = () => {
  const { strings } = useChatbot()
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Bot className="w-6 h-6 mr-2 text-primary-600" />
          {strings.title}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{strings.subtitle}</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm h-[620px] overflow-hidden">
        <ChatPanel variant="page" />
      </div>
    </div>
  )
}

export default ChatbotSettings
