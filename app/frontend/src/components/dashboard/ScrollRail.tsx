"use client";

/**
 * Horizontal scroll region for dense match strips — daily “ticker” style browsing.
 */
export function ScrollRail({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex gap-4 overflow-x-auto pb-2 pt-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin] snap-x snap-mandatory ${className}`}
      role="region"
    >
      {children}
    </div>
  );
}
