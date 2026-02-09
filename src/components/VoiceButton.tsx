import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";

interface VoiceButtonProps {
  isListening: boolean;
  isSpeaking: boolean;
  onToggleListen: () => void;
  onStopSpeaking: () => void;
  disabled?: boolean;
}

const VoiceButton = ({ isListening, isSpeaking, onToggleListen, onStopSpeaking, disabled }: VoiceButtonProps) => {
  if (isSpeaking) {
    return (
      <button
        onClick={onStopSpeaking}
        className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary text-primary flex items-center justify-center hover:bg-primary/30 transition-all duration-300 animate-pulse-glow"
      >
        <VolumeX size={24} />
      </button>
    );
  }

  return (
    <button
      onClick={onToggleListen}
      disabled={disabled}
      className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
        isListening
          ? "bg-accent/20 border-2 border-accent text-accent animate-pulse-glow-active"
          : "bg-secondary border-2 border-border text-muted-foreground hover:border-primary hover:text-primary"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {isListening ? <MicOff size={24} /> : <Mic size={24} />}
    </button>
  );
};

export default VoiceButton;
