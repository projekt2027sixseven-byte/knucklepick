"use client";

/**
 * Fixed dreamscape layer: soft gradients + floating blobs.
 * Respects prefers-reduced-motion (animations are motion-safe:* in Tailwind).
 */
export function DreamBackground() {
  return (
    <div className="dream-bg-root fixed inset-0 -z-[1] overflow-hidden pointer-events-none" aria-hidden>
      <div className="absolute inset-0 bg-dream-base" />
      <div className="dream-bg-mesh absolute inset-0 opacity-[0.95]" />
      <div className="dream-blob dream-blob-a absolute -top-[20%] -left-[15%] w-[min(85vw,520px)] h-[min(85vw,520px)] rounded-[45%_55%_60%_40%] bg-gradient-to-br from-fuchsia-500/35 via-purple-500/25 to-transparent blur-[80px] motion-safe:animate-dream-blob-a" />
      <div className="dream-blob dream-blob-b absolute top-[35%] -right-[20%] w-[min(90vw,480px)] h-[min(90vw,480px)] rounded-[55%_45%_40%_60%] bg-gradient-to-bl from-orange-400/30 via-rose-400/20 to-transparent blur-[90px] motion-safe:animate-dream-blob-b" />
      <div className="dream-blob dream-blob-c absolute -bottom-[15%] left-[15%] w-[min(70vw,420px)] h-[min(70vw,420px)] rounded-[40%_60%_55%_45%] bg-gradient-to-tr from-violet-500/35 via-sky-500/20 to-cyan-400/15 blur-[85px] motion-safe:animate-dream-blob-c" />
      <div className="absolute inset-0 opacity-[0.12] mix-blend-overlay dream-noise" />
    </div>
  );
}
