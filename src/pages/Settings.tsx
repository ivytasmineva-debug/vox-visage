import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Box, Layers } from "lucide-react";

const MODELS = [
  {
    id: "model-1",
    name: "Avatar Alpha",
    path: "/698bdd8efcad0d2f33536b28.glb",
    description: "ডিফল্ট হিউম্যানয়েড অ্যাভাটার",
  },
  {
    id: "model-2",
    name: "Animated Avatar",
    path: "/animation.glb",
    description: "অ্যানিমেশন সহ 3D মডেল",
  },
  {
    id: "model-3",
    name: "Character Model",
    path: "/model (1).glb",
    description: "বিকল্প ক্যারেক্টার মডেল",
  },
  {
    id: "model-4",
    name: "Standard Model",
    path: "/model.glb",
    description: "স্ট্যান্ডার্ড 3D অ্যাভাটার",
  },
];

const STORAGE_KEY = "aura-selected-model";
const ZINDEX_KEY = "aura-overlay-zindex";

const ZINDEX_OPTIONS = [
  { label: "সবার উপরে (Top)", value: 9999 },
  { label: "মাঝামাঝি (Mid)", value: 100 },
  { label: "চ্যাটের নিচে (Below Chat)", value: 10 },
  { label: "ব্যাকগ্রাউন্ড (Background)", value: 1 },
];

const Settings = () => {
  const navigate = useNavigate();
  const [selectedModel, setSelectedModel] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || MODELS[0].path;
  });
  const [zIndex, setZIndex] = useState(() => {
    const stored = localStorage.getItem(ZINDEX_KEY);
    return stored ? parseInt(stored, 10) : 9999;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    localStorage.setItem(ZINDEX_KEY, String(zIndex));
  }, [zIndex]);

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-3 border-b border-border">
        <button
          onClick={() => navigate("/")}
          className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-display font-bold tracking-widest text-primary">
          SETTINGS
        </h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Model Selection */}
          <section>
            <h2 className="font-display text-sm tracking-wider text-muted-foreground uppercase mb-4">
              3D Avatar Model নির্বাচন করুন
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MODELS.map((model) => {
                const isSelected = selectedModel === model.path;
                return (
                  <button
                    key={model.id}
                    onClick={() => setSelectedModel(model.path)}
                    className={`relative flex items-start gap-3 p-4 rounded-xl border transition-all duration-200 text-left ${
                      isSelected
                        ? "border-primary bg-primary/10 shadow-[0_0_20px_hsl(200_90%_55%/0.15)]"
                        : "border-border bg-card hover:border-muted-foreground/30 hover:bg-secondary"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {isSelected ? <Check size={16} /> : <Box size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-semibold ${
                          isSelected ? "text-primary" : "text-foreground"
                        }`}
                      >
                        {model.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {model.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Overlay Stack Order */}
          <section>
            <h2 className="font-display text-sm tracking-wider text-muted-foreground uppercase mb-4 flex items-center gap-2">
              <Layers size={14} />
              ওভারলে স্ট্যাক অর্ডার
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {ZINDEX_OPTIONS.map((opt) => {
                const isActive = zIndex === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setZIndex(opt.value)}
                    className={`p-3 rounded-xl border text-left text-sm transition-all duration-200 ${
                      isActive
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border bg-card hover:border-muted-foreground/30 hover:bg-secondary text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Avatar ওভারলে কোন লেয়ারে দেখাবে তা নির্ধারণ করুন।
            </p>
          </section>

          {/* Preview thumbnail */}
          <section>
            <h2 className="font-display text-sm tracking-wider text-muted-foreground uppercase mb-3">
              প্রিভিউ
            </h2>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <img
                src="/avaturn_screenshot.jpg"
                alt="Avatar Preview"
                className="w-full h-48 object-cover opacity-80"
              />
            </div>
          </section>

          {/* Start Button */}
          <button
            onClick={() => navigate("/")}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-display font-bold tracking-widest text-sm hover:brightness-110 transition-all shadow-[0_0_20px_hsl(200_90%_55%/0.3)]"
          >
            START AURA →
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
