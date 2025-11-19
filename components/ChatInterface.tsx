import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Search } from 'lucide-react';
import { Message, Language } from '../types';
import { chatWithCoffeeExpert } from '../services/gemini';
import ReactMarkdown from 'react-markdown';

interface ChatInterfaceProps {
  language: Language;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ language }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const t = {
    title: language === 'en' ? 'Barista Chat' : '咖啡师咨询',
    welcome: language === 'en' 
      ? "Hello! I'm your Coffee Master. Ask me anything about coffee beans, brewing methods, or finding the best cafes!"
      : "你好！我是你的专属咖啡大师。关于咖啡豆、冲煮方法或寻找好喝的咖啡馆，尽管问我！",
    placeholder: language === 'en' ? "Ask about beans, brewing, or recipes..." : "询问关于豆子、冲煮或配方的问题...",
    you: language === 'en' ? "You" : "你",
    master: language === 'en' ? "Master" : "大师",
    sources: language === 'en' ? "Sources" : "参考来源",
    error: language === 'en' 
      ? "Sorry, I'm having trouble connecting to the coffee spirits right now. Please try again."
      : "抱歉，我现在连接咖啡之神有点困难，请稍后再试。"
  };

  // Reset welcome message when language changes, if it's the only message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: 'init',
        role: 'model',
        text: t.welcome,
      }]);
    }
  }, [language]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Prepare history for API
      const historyForApi = messages
        .filter(m => m.id !== 'init') // exclude init message if preferred, or include it as model turn
        .map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        }));

      const response = await chatWithCoffeeExpert(historyForApi, userMsg.text, language);

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.text || "",
        sources: response.groundingMetadata?.groundingChunks?.map((chunk: any) => {
            if (chunk.web?.uri) {
                return { uri: chunk.web.uri, title: chunk.web.title };
            }
            return null;
        }).filter(Boolean)
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: t.error,
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-xl shadow-lg overflow-hidden border border-coffee-200">
      <div className="bg-coffee-600 p-4 text-white flex items-center gap-2">
        <Bot className="w-6 h-6" />
        <h2 className="font-serif font-bold text-lg">{t.title}</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-coffee-50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${
                msg.role === 'user'
                  ? 'bg-coffee-600 text-white rounded-br-none'
                  : 'bg-white text-coffee-900 border border-coffee-100 rounded-bl-none'
              }`}
            >
              <div className="flex items-center gap-2 mb-1 opacity-70 text-xs uppercase tracking-wider">
                {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                <span>{msg.role === 'user' ? t.you : t.master}</span>
              </div>
              <div className="prose prose-sm max-w-none prose-p:my-1 prose-a:text-blue-600 dark:prose-invert">
                 <ReactMarkdown>{msg.text}</ReactMarkdown>
              </div>
              
              {/* Grounding Sources */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                    <Search size={12} />
                    <span>{t.sources}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {msg.sources.map((source, idx) => (
                      <a
                        key={idx}
                        href={source.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded-md truncate max-w-[200px] transition-colors"
                      >
                        {source.title || source.uri}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
             <div className="bg-white p-4 rounded-2xl rounded-bl-none shadow-sm border border-coffee-100">
                <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-coffee-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-coffee-400 rounded-full animate-bounce delay-75"></div>
                    <div className="w-2 h-2 bg-coffee-400 rounded-full animate-bounce delay-150"></div>
                </div>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-coffee-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={t.placeholder}
            className="flex-1 px-4 py-3 rounded-xl border border-coffee-200 focus:outline-none focus:ring-2 focus:ring-coffee-500 bg-coffee-50 text-coffee-900 placeholder-coffee-300 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="bg-coffee-600 hover:bg-coffee-700 disabled:bg-coffee-300 text-white p-3 rounded-xl transition-colors shadow-md"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
