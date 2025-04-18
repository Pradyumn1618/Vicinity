import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define the type for your context
type ChatContextType = {
  currentChatId: string | null;
  setCurrentChatId: (chatId: string | null) => void;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  chats: ChatPreview[];
  setChats: React.Dispatch<React.SetStateAction<ChatPreview[]>>;
};

type ChatPreview = {
  id: string;
  participants: string[];
  photoURL?: string;
  username?: string;
  unreadCount?: number;
};

interface Message {
    id: string;
    text: string;
    sender: string;
    timestamp: number;
    media?: string | null;
    replyTo?: { text: string; id: string } | null;
    delivered?: boolean;
    seen?: boolean;
  }

// Create context with proper default values
const ChatContext = createContext<ChatContextType>({
  currentChatId: null,
  setCurrentChatId: () => {},
    messages: [],
    setMessages: () => {},
    chats: [],
    setChats: () => {},
});



// ChatProvider props type
type ChatProviderProps = {
  children: ReactNode;
};

export const ChatProvider = ({ children }: ChatProviderProps) => {
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chats, setChats] = useState<ChatPreview[]>([]);

  return (
    <ChatContext.Provider value={{ currentChatId, setCurrentChatId, messages, setMessages, chats, setChats }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = () => useContext(ChatContext);

