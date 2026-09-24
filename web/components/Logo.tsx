export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <rect x="1.5" y="1.5" width="29" height="29" rx="8" stroke="#212a3a" strokeWidth="1.5" />
      <path
        d="M9 21.5V10.5h9.5a3.5 3.5 0 0 1 0 7H13"
        stroke="#5eead4"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="23" cy="21.5" r="2.4" fill="#5eead4" />
    </svg>
  );
}
