import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import ChatPanel from './ChatPanel'

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 bg-primary-600 text-white p-4 rounded-full shadow-xl hover:bg-primary-700 hover:scale-105 transition-all z-50"
        >
          <MessageSquare className="w-6 h-6 text-white" />
        </button>
      )}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 sm:w-[420px] h-[560px] rounded-2xl shadow-2xl z-50 border border-gray-200 overflow-hidden">
          <ChatPanel variant="float" onClose={() => setIsOpen(false)} />
        </div>
      )}
    </>
  )
}

export default Chatbot
