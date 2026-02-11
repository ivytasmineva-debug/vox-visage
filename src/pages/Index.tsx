import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Settings } from "lucide-react";
import { Msg, streamChat } from "@/lib/streamChat";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import Avatar3D from "@/components/Avatar3D";
import ChatMessage from "@/components/ChatMessage";
import VoiceButton from "@/components/VoiceButton";
import LanguageToggle from "@/components/LanguageToggle";
import { toast } from "sonner";

const STORAGE_KEY = "aura-selected-model";

const Index = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lang, setLang] = useState<"bn-BD" | "en-US">("bn-BD");
  const [glbUrl, setGlbUrl] = useState(() => localStorage.getItem(STORAGE_KEY) || "/698bdd8efcad0d2f33536b28.glb");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { isListening, transcript, startListening, stopListening } = useSpeechRecognition();
  const { speak, stop: stopSpeaking, isSpeaking } = useSpeechSynthesis();

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // When transcript is finalized and user stops listening, send it
  const prevListeningRef = useRef(false);
  useEffect(() => {
    if (prevListeningRef.current && !isListening && transcript.trim()) {
      handleSend(transcript.trim());
    }
    prevListeningRef.current = isListening;
  }, [isListening]);

  // Update input while listening
  useEffect(() => {
    if (isListening && transcript) {
      setInput(transcript);
    }
  }, [transcript, isListening]);

  const handleSend = useCallback(
    async (text?: string) => {
      const msgText = text || input.trim();
      if (!msgText || isLoading) return;

      setInput("");
      const userMsg: Msg = { role: "user", content: msgText };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      let assistantSoFar = "";
      const upsertAssistant = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
      };

      try {
        await streamChat({
          messages: [...messages, userMsg],
          onDelta: upsertAssistant,
          onDone: () => {
            setIsLoading(false);
            if (assistantSoFar) {
              speak(assistantSoFar, lang);
            }
          },
        });
      } catch (e: any) {
        setIsLoading(false);
        toast.error(e.message || "Something went wrong");
      }
    },
    [input, isLoading, messages, speak, lang]
  );

  const toggleListen = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening(lang);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border">
        <h1 className="text-lg font-display font-bold tracking-widest text-primary">
          AURA
        </h1>
        <div className="flex items-center gap-2">
          <LanguageToggle lang={lang} onToggle={() => setLang((l) => (l === "bn-BD" ? "en-US" : "bn-BD"))} />
          <button
            onClick={() => navigate("/settings")}
            className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-primary"
            title="Settings"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center overflow-hidden">
        {/* 3D Avatar section */}
        <div className="w-full max-w-lg">
          <Avatar3D isListening={isListening} isSpeaking={isSpeaking} isThinking={isLoading} glbUrl={glbUrl} />
        </div>

        {/* Chat area */}
        <div className="flex-1 w-full max-w-2xl overflow-y-auto px-4 pb-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground mt-4">
              <p className="font-display text-sm tracking-wider">
                {lang === "bn-BD"
                  ? "আমি AURA, আপনার AI সহকারী। কিছু জিজ্ঞেস করুন!"
                  : "I'm AURA, your AI assistant. Ask me anything!"}
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <ChatMessage key={i} {...msg} />
          ))}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="border-t border-border px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <VoiceButton
            isListening={isListening}
            isSpeaking={isSpeaking}
            onToggleListen={toggleListen}
            onStopSpeaking={stopSpeaking}
            disabled={isLoading}
          />

          <div className="flex-1 flex items-center gap-2 bg-secondary rounded-full border border-border px-4 py-2 focus-within:border-primary transition-colors">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={lang === "bn-BD" ? "টাইপ করুন বা কথা বলুন..." : "Type or speak..."}
              className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
              disabled={isLoading}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="text-muted-foreground hover:text-primary disabled:opacity-30 transition-colors"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
