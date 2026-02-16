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
import LipSyncCalibration, { CALIBRATION_KEY } from "@/components/LipSyncCalibration";
import { toast } from "sonner";

const STORAGE_KEY = "aura-selected-model";

const Index = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lang, setLang] = useState<"bn-BD" | "en-US">("bn-BD");
  const [glbUrl, setGlbUrl] = useState(() => localStorage.getItem(STORAGE_KEY) || "/698bdd8efcad0d2f33536b28.glb");
  const [showCalibration, setShowCalibration] = useState(() => !localStorage.getItem(CALIBRATION_KEY));
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { isListening, transcript, startListening, stopListening } = useSpeechRecognition();
  const { speak, stop: stopSpeaking, isSpeaking } = useSpeechSynthesis();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const prevListeningRef = useRef(false);
  useEffect(() => {
    if (prevListeningRef.current && !isListening && transcript.trim()) {
      handleSend(transcript.trim());
    }
    prevListeningRef.current = isListening;
  }, [isListening]);

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
    <div className="relative h-screen w-screen overflow-hidden" style={{ background: "transparent" }}>
      {/* First-run lip-sync calibration */}
      {showCalibration && <LipSyncCalibration onComplete={() => setShowCalibration(false)} />}

      {/* Fullscreen 3D Avatar as base layer */}
      <Avatar3D isListening={isListening} isSpeaking={isSpeaking} isThinking={isLoading} glbUrl={glbUrl} />

      {/* Header overlay on top */}
      <header className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-3 z-[10001] bg-background/20 backdrop-blur-sm border-b border-border/20">
        <h1 className="text-lg font-display font-bold tracking-widest text-primary">
          AURA
        </h1>
        <div className="flex items-center gap-2">
          <LanguageToggle lang={lang} onToggle={() => setLang((l) => (l === "bn-BD" ? "en-US" : "bn-BD"))} />
          <button
            onClick={() => navigate("/settings")}
            className="p-2 rounded-lg hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-primary"
            title="Settings"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Chat messages overlay */}
      <div className="absolute top-14 bottom-20 left-0 right-0 z-[10001] overflow-y-auto px-4 pointer-events-auto">
        <div className="max-w-2xl mx-auto space-y-4 pb-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground/70 mt-4">
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

      {/* Input bar overlay at bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-[10001] px-4 py-4 bg-background/20 backdrop-blur-sm border-t border-border/20">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <VoiceButton
            isListening={isListening}
            isSpeaking={isSpeaking}
            onToggleListen={toggleListen}
            onStopSpeaking={stopSpeaking}
            disabled={isLoading}
          />
          <div className="flex-1 flex items-center gap-2 bg-secondary/40 rounded-full border border-border/30 px-4 py-2 focus-within:border-primary transition-colors backdrop-blur-sm">
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
