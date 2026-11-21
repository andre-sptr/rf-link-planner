export interface BrandTowerIconProps {
  className?: string;
}

export function BrandTowerIcon({ className = 'w-7 h-7' }: BrandTowerIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="ls-brand-tower-bg"
          x1="8"
          y1="4"
          x2="56"
          y2="60"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#112848" />
          <stop offset="100%" stopColor="#091322" />
        </linearGradient>
        <radialGradient
          id="ls-brand-beacon-glow"
          cx="32"
          cy="14"
          r="14"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="15"
        fill="url(#ls-brand-tower-bg)"
        stroke="#38bdf8"
        strokeOpacity="0.32"
        strokeWidth="1.5"
      />
      <circle cx="32" cy="14" r="14" fill="url(#ls-brand-beacon-glow)" />

      <path
        d="M 25.5 9.2 A 8.1 8.1 0 0 0 25.5 18.8"
        stroke="#38bdf8"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M 38.5 9.2 A 8.1 8.1 0 0 1 38.5 18.8"
        stroke="#38bdf8"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M 21.2 6.2 A 13.3 13.3 0 0 0 21.2 21.8"
        stroke="#34d399"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M 42.8 6.2 A 13.3 13.3 0 0 1 42.8 21.8"
        stroke="#34d399"
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      <line
        x1="15.5"
        y1="53"
        x2="48.5"
        y2="53"
        stroke="#38bdf8"
        strokeOpacity="0.5"
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      <g
        stroke="#94a3b8"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="21" y1="53" x2="39.9" y2="42" />
        <line x1="43" y1="53" x2="24.1" y2="42" />
        <line x1="24.1" y1="42" x2="37" y2="32" />
        <line x1="39.9" y1="42" x2="27" y2="32" />
        <line x1="27" y1="32" x2="34.2" y2="22" />
        <line x1="37" y1="32" x2="29.8" y2="22" />
      </g>
      <g stroke="#cbd5e1" strokeWidth="1.9" strokeLinecap="round">
        <line x1="24.1" y1="42" x2="39.9" y2="42" />
        <line x1="27" y1="32" x2="37" y2="32" />
        <line x1="29.8" y1="22" x2="34.2" y2="22" />
      </g>

      <path
        d="M 21 53 L 29.8 22 L 32 14 L 34.2 22 L 43 53"
        stroke="#f8fafc"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="32"
        y1="22"
        x2="32"
        y2="14"
        stroke="#f8fafc"
        strokeWidth="2.3"
        strokeLinecap="round"
      />

      <circle
        cx="32"
        cy="14"
        r="2.8"
        fill="#38bdf8"
        stroke="#ffffff"
        strokeWidth="1.4"
      />
    </svg>
  );
}
