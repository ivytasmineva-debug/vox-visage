import avatarImage from "@/assets/avatar.png";

interface AvatarDisplayProps {
  isListening: boolean;
  isSpeaking: boolean;
  isThinking: boolean;
}

const AvatarDisplay = ({ isListening, isSpeaking, isThinking }: AvatarDisplayProps) => {
  const ringClass = isListening
    ? "animate-pulse-glow-active border-accent"
    : isSpeaking
    ? "animate-pulse-glow border-primary"
    : "animate-pulse-glow border-border";

  return (
    <div className="relative flex flex-col items-center">
      {/* Outer glow ring */}
      <div className={`relative rounded-full p-1 border-2 transition-colors duration-500 ${ringClass}`}>
        <div className="w-48 h-48 md:w-64 md:h-64 rounded-full overflow-hidden bg-secondary">
          <img
            src={avatarImage}
            alt="AURA AI Assistant"
            className={`w-full h-full object-cover object-top transition-transform duration-1000 ${
              isSpeaking ? "scale-105" : "scale-100"
            }`}
          />
        </div>
      </div>

      {/* Status indicator */}
      <div className="mt-4 flex items-center gap-2">
        <div
          className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
            isListening
              ? "bg-accent"
              : isSpeaking
              ? "bg-primary"
              : isThinking
              ? "bg-accent animate-pulse"
              : "bg-muted-foreground"
          }`}
        />
        <span className="text-sm text-muted-foreground font-display tracking-wider uppercase">
          {isListening
            ? "Listening..."
            : isSpeaking
            ? "Speaking..."
            : isThinking
            ? "Thinking..."
            : "Ready"}
        </span>
      </div>

      {/* Sound wave visualizer when listening */}
      {isListening && (
        <div className="mt-3 flex items-end gap-1 h-6">
          {[...Array(7)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-accent rounded-full"
              style={{
                animation: `wave-bar 0.6s ease-in-out ${i * 0.08}s infinite`,
                height: "4px",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AvatarDisplay;
