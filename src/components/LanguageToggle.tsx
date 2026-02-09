interface LanguageToggleProps {
  lang: "bn-BD" | "en-US";
  onToggle: () => void;
}

const LanguageToggle = ({ lang, onToggle }: LanguageToggleProps) => {
  return (
    <button
      onClick={onToggle}
      className="px-3 py-1.5 rounded-full text-xs font-display tracking-wider border border-border bg-secondary text-muted-foreground hover:border-primary hover:text-primary transition-all duration-300"
    >
      {lang === "bn-BD" ? "বাংলা" : "ENG"}
    </button>
  );
};

export default LanguageToggle;
