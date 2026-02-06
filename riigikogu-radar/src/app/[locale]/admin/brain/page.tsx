"use client";

import { useState, useEffect, useRef } from "react";

interface ChatMessage {
  role: "human" | "brain";
  content: string;
  timestamp: string;
  actionItems?: string[];
}

interface ActionItem {
  _id: string;
  action: string;
  status: string;
  createdAt: string;
}

export default function BrainChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingActions, setPendingActions] = useState<ActionItem[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch existing messages on load
  useEffect(() => {
    fetchMessages();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const response = await fetch("/api/v1/brain/chat");
      const data = await response.json();
      if (data.success) {
        setMessages(data.data.messages || []);
        setPendingActions(data.data.pendingActions || []);
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);
    setError(null);

    // Optimistically add user message
    const tempUserMessage: ChatMessage = {
      role: "human",
      content: userMessage,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMessage]);

    try {
      const response = await fetch("/api/v1/brain/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage })
      });

      const data = await response.json();

      if (data.success) {
        const brainMessage: ChatMessage = {
          role: "brain",
          content: data.data.response,
          timestamp: data.data.timestamp,
          actionItems: data.data.actionItems
        };
        setMessages(prev => [...prev, brainMessage]);

        // Refresh action items
        fetchMessages();
      } else {
        setError(data.error || "Failed to send message");
      }
    } catch (err) {
      setError("Failed to communicate with brain");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("et-EE", {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-4xl mx-auto p-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">🧠</span> Brain Chat
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Communicate with the autonomous brain in natural language
          </p>
        </div>

        {/* Status Bar */}
        <div className="bg-gray-900 rounded-lg p-3 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-300">Brain is alive</span>
          </div>
          {pendingActions.length > 0 && (
            <div className="text-sm text-yellow-400">
              {pendingActions.length} pending action{pendingActions.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>

        {/* Chat Container */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 h-[500px] flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 mt-20">
                <p className="text-lg mb-2">No messages yet</p>
                <p className="text-sm">Start a conversation with the brain</p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "human" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      msg.role === "human"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-800 text-gray-100"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs opacity-70">
                        {msg.role === "human" ? "You" : "🧠 Brain"}
                      </span>
                      <span className="text-xs opacity-50">
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                    <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                    {msg.actionItems && msg.actionItems.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-700">
                        <div className="text-xs text-yellow-400 mb-1">Action Items:</div>
                        {msg.actionItems.map((action, i) => (
                          <div key={i} className="text-xs text-gray-300 flex items-start gap-1">
                            <span>•</span>
                            <span>{action}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Error Message */}
          {error && (
            <div className="px-4 py-2 bg-red-900/50 text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-gray-800 p-4">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message to the brain..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                rows={1}
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Send
              </button>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Press Enter to send • The brain responds instantly via Claude API
            </div>
          </div>
        </div>

        {/* Pending Actions */}
        {pendingActions.length > 0 && (
          <div className="mt-4 bg-gray-900 rounded-lg border border-gray-800 p-4">
            <h3 className="text-sm font-medium text-yellow-400 mb-2">
              Pending Actions (will be processed by PM operative)
            </h3>
            <div className="space-y-2">
              {pendingActions.map((action) => (
                <div
                  key={action._id}
                  className="text-sm text-gray-300 flex items-start gap-2"
                >
                  <span className="text-yellow-500">⏳</span>
                  <span>{action.action}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setInput("What's the current system status?")}
            className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1 rounded-full transition-colors"
          >
            System status
          </button>
          <button
            onClick={() => setInput("What are the current priorities?")}
            className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1 rounded-full transition-colors"
          >
            Priorities
          </button>
          <button
            onClick={() => setInput("What did the operatives do in the last cycle?")}
            className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1 rounded-full transition-colors"
          >
            Last cycle
          </button>
          <button
            onClick={() => setInput("Add a new priority: ")}
            className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1 rounded-full transition-colors"
          >
            Add priority
          </button>
        </div>
      </div>
    </div>
  );
}
