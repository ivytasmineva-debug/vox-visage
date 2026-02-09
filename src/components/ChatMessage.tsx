import { Msg } from "@/lib/streamChat";
import { User, Bot } from "lucide-react";

const ChatMessage = ({ role, content }: Msg) => {
  const isUser = role === "user";

  return (
    <div className={`flex gap-3 animate-fade-in-up ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? "bg-accent/20 text-accent" : "bg-primary/20 text-primary"
        }`}
      >
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-accent/10 text-foreground border border-accent/20"
            : "bg-secondary text-foreground border border-border"
        }`}
      >
        {content}
      </div>
    </div>
  );
};

export default ChatMessage;
