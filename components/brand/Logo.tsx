/** Product mark for the platform (non-broker) pages. */
export function ProductMark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" className="fill-ink" />
        <path d="M8 22V10h5.5a6 6 0 0 1 0 12H8Z" fill="none" className="stroke-accent" strokeWidth="2.6" />
        <path d="M19 22l5-12" className="stroke-page" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
      <span className="font-display text-lg tracking-tight">DSCR Toolkit</span>
    </span>
  );
}
