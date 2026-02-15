import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, CheckCircle, Volume2 } from "lucide-react";

const CALIBRATION_KEY = "aura-lipsync-calibrated";
const LIPSYNC_GAIN_KEY = "aura-lipsync-gain";
const LIPSYNC_SMOOTHING_KEY = "aura-lipsync-smoothing";

interface LipSyncCalibrationProps {
  onComplete: () => void;
}

const LipSyncCalibration = ({ onComplete }: LipSyncCalibrationProps) => {
  const [step, setStep] = useState<"intro" | "testing" | "done">("intro");
  const [micLevel, setMicLevel] = useState(0);
  const [gain, setGain] = useState(() => {
    const stored = localStorage.getItem(LIPSYNC_GAIN_KEY);
    return stored ? parseFloat(stored) : 3.0;
  });
  const [smoothing, setSmoothing] = useState(() => {
    const stored = localStorage.getItem(LIPSYNC_SMOOTHING_KEY);
    return stored ? parseFloat(stored) : 0.15;
  });

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number | null>(null);

  const startMicTest = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      setStep("testing");

      const data = new Uint8Array(analyser.fftSize);
      const loop = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        setMicLevel(Math.min(1, rms * gain * 3.5));
        animRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch {
      // Mic denied — skip calibration
      handleComplete();
    }
  }, [gain]);

  const stopMic = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    analyserRef.current?.disconnect();
    audioCtxRef.current?.close();
  }, []);

  const handleComplete = useCallback(() => {
    stopMic();
    localStorage.setItem(CALIBRATION_KEY, "true");
    localStorage.setItem(LIPSYNC_GAIN_KEY, String(gain));
    localStorage.setItem(LIPSYNC_SMOOTHING_KEY, String(smoothing));
    setStep("done");
    setTimeout(onComplete, 800);
  }, [gain, smoothing, stopMic, onComplete]);

  useEffect(() => () => stopMic(), [stopMic]);

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-background/80 backdrop-blur-md">
      <div className="w-full max-w-md mx-4 p-6 rounded-2xl bg-card border border-border shadow-2xl space-y-6">
        <h2 className="text-xl font-display font-bold text-primary text-center tracking-wider">
          লিপ-সিঙ্ক ক্যালিব্রেশন
        </h2>

        {step === "intro" && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              আপনার মাইক্রোফোন টেস্ট করে লিপ-সিঙ্ক সেটআপ করুন। কথা বলুন এবং লেভেল বার দেখুন।
            </p>
            <button
              onClick={startMicTest}
              className="mx-auto flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
            >
              <Mic size={18} />
              মাইক টেস্ট শুরু করুন
            </button>
            <button
              onClick={handleComplete}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              এড়িয়ে যান →
            </button>
          </div>
        )}

        {step === "testing" && (
          <div className="space-y-5">
            {/* Mic level visualizer */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Volume2 size={16} className="text-primary" />
                <span>মাইক লেভেল</span>
              </div>
              <div className="h-4 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-75"
                  style={{ width: `${micLevel * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                কথা বলুন — বার সবুজ হলে ক্যালিব্রেশন ঠিক আছে
              </p>
            </div>

            {/* Gain slider */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground flex justify-between">
                <span>সেন্সিটিভিটি (Gain)</span>
                <span>{gain.toFixed(1)}x</span>
              </label>
              <input
                type="range"
                min="0.5"
                max="8"
                step="0.1"
                value={gain}
                onChange={(e) => setGain(parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            {/* Smoothing slider */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground flex justify-between">
                <span>স্মুদনেস</span>
                <span>{smoothing.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="0.05"
                max="0.4"
                step="0.01"
                value={smoothing}
                onChange={(e) => setSmoothing(parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <button
              onClick={handleComplete}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
            >
              <CheckCircle size={18} />
              সম্পন্ন
            </button>
          </div>
        )}

        {step === "done" && (
          <div className="text-center space-y-3">
            <CheckCircle size={48} className="mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">ক্যালিব্রেশন সম্পন্ন!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export { CALIBRATION_KEY, LIPSYNC_GAIN_KEY, LIPSYNC_SMOOTHING_KEY };
export default LipSyncCalibration;
