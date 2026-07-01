"use client";

/* ── City markers on the atlas globe ────────────────────────────── */
const CITIES = [
  { id: "lon", name: "London",       flag: "🇬🇧", score: 87, cx: 252, cy: 153,
    card: { side: "right", label: "↑ High conviction", labelColor: "#00C805" } },
  { id: "nyc", name: "New York",     flag: "🇺🇸", score: 83, cx: 138, cy: 182,
    card: { side: "left",  label: "↑ Growing fast",    labelColor: "#00C805" } },
  { id: "man", name: "Manchester",   flag: "🇬🇧", score: 78, cx: 244, cy: 145,
    card: { side: "left",  label: "↑ BTR pipeline",    labelColor: "#00C805" } },
  { id: "mia", name: "Miami",        flag: "🇺🇸", score: 74, cx: 148, cy: 205,
    card: null },
] as const;

/* ── Simplified continent outlines ──────────────────────────────── */
const LANDMASSES = [
  // North America
  "M 82,95 L 138,78 L 182,92 L 195,112 L 182,142 L 162,165 L 132,170 L 105,155 L 85,130 Z",
  // South America
  "M 150,242 L 182,236 L 200,255 L 196,292 L 178,325 L 155,328 L 140,305 L 138,272 Z",
  // Europe (small, north of Africa)
  "M 242,128 L 276,123 L 298,137 L 292,162 L 265,170 L 242,160 L 237,145 Z",
  // Africa
  "M 248,192 L 276,188 L 302,202 L 310,242 L 295,282 L 270,305 L 244,300 L 228,268 L 224,238 Z",
  // Asia (large eastern land mass)
  "M 295,108 L 362,96 L 428,112 L 442,142 L 432,168 L 398,180 L 352,177 L 308,166 L 293,142 Z",
  // Australia
  "M 383,296 L 415,284 L 442,296 L 446,320 L 426,336 L 398,333 L 380,316 Z",
];

/* ── Globe SVG component ─────────────────────────────────────────── */
export function AtlasGlobe() {
  return (
    <div className="relative w-full max-w-[580px] mx-auto select-none" aria-hidden="true">

      {/* ── SVG globe ── */}
      <svg viewBox="0 0 500 500" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <clipPath id="gc">
            <circle cx="250" cy="250" r="218" />
          </clipPath>
          <radialGradient id="gg" cx="38%" cy="32%" r="68%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#EAEAE0" />
          </radialGradient>
        </defs>

        {/* Drop shadow */}
        <ellipse cx="253" cy="258" rx="214" ry="214" fill="rgba(0,0,0,0.07)" />

        {/* Globe sphere */}
        <circle cx="250" cy="250" r="218" fill="url(#gg)" />

        {/* Clipped interior */}
        <g clipPath="url(#gc)">

          {/* Latitude lines */}
          <g stroke="#C5C6B8" strokeWidth="0.7" fill="none" opacity="0.7">
            <line x1="32"  y1="130" x2="468" y2="130" />
            <line x1="32"  y1="178" x2="468" y2="178" />
            <line x1="32"  y1="250" x2="468" y2="250" />
            <line x1="32"  y1="322" x2="468" y2="322" />
            <line x1="32"  y1="370" x2="468" y2="370" />
          </g>

          {/* Longitude lines */}
          <g stroke="#C5C6B8" strokeWidth="0.7" fill="none" opacity="0.7">
            <line x1="105" y1="32" x2="105" y2="468" />
            <line x1="178" y1="32" x2="178" y2="468" />
            <line x1="250" y1="32" x2="250" y2="468" />
            <line x1="322" y1="32" x2="322" y2="468" />
            <line x1="395" y1="32" x2="395" y2="468" />
          </g>

          {/* Land masses */}
          <g fill="#D2D1C1" opacity="0.75">
            {LANDMASSES.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>

          {/* Subtle sphere highlight */}
          <circle cx="200" cy="180" r="120" fill="white" opacity="0.07" />
        </g>

        {/* Globe border */}
        <circle cx="250" cy="250" r="218" fill="none" stroke="#D5D6CA" strokeWidth="1.5" />

        {/* ── City dots ── */}
        {CITIES.map((city, i) => (
          <g key={city.id}>
            {/* Pulse ring */}
            <circle cx={city.cx} cy={city.cy} r="6" fill="#00C805" opacity="0.3">
              <animate
                attributeName="r"
                values="5;18;5"
                dur="2.6s"
                repeatCount="indefinite"
                begin={`${i * 0.55}s`}
              />
              <animate
                attributeName="opacity"
                values="0.4;0;0.4"
                dur="2.6s"
                repeatCount="indefinite"
                begin={`${i * 0.55}s`}
              />
            </circle>
            {/* Outer ring */}
            <circle cx={city.cx} cy={city.cy} r="6" fill="#00C805" opacity="0.2" />
            {/* Core */}
            <circle cx={city.cx} cy={city.cy} r="4" fill="#00C805" />
            <circle cx={city.cx} cy={city.cy} r="2" fill="#CCFF00" />
          </g>
        ))}
      </svg>

      {/* ── Floating score cards ── */}

      {/* London — upper right */}
      <div className="absolute top-[14%] right-[2%] bg-white/96 border border-black/[0.07] rounded-2xl px-4 py-3 shadow-md">
        <p className="text-[9px] font-semibold text-black/40 uppercase tracking-widest">LONDON · UK</p>
        <p className="text-3xl font-black tracking-tight tabular-nums text-black leading-none mt-0.5">87</p>
        <p className="text-[9px] font-semibold uppercase tracking-widest mt-1" style={{ color: "#00C805" }}>↑ High conviction</p>
      </div>

      {/* New York — left middle */}
      <div className="absolute top-[38%] -left-[4%] bg-white/96 border border-black/[0.07] rounded-2xl px-4 py-3 shadow-md">
        <p className="text-[9px] font-semibold text-black/40 uppercase tracking-widest">NEW YORK · US</p>
        <p className="text-3xl font-black tracking-tight tabular-nums text-black leading-none mt-0.5">83</p>
        <p className="text-[9px] font-semibold uppercase tracking-widest mt-1" style={{ color: "#00C805" }}>↑ Growing fast</p>
      </div>

      {/* Sydney — lower right */}
      <div className="absolute bottom-[18%] right-[4%] bg-white/96 border border-black/[0.07] rounded-2xl px-4 py-3 shadow-md">
        <p className="text-[9px] font-semibold text-black/40 uppercase tracking-widest">SYDNEY · AU</p>
        <p className="text-3xl font-black tracking-tight tabular-nums text-black leading-none mt-0.5">71</p>
        <p className="text-[9px] font-semibold uppercase tracking-widest mt-1" style={{ color: "#F5A623" }}>→ Moderate</p>
      </div>

      {/* Market count badge — bottom left */}
      <div className="absolute bottom-[5%] left-[12%] bg-black text-white rounded-full px-4 py-1.5 text-[11px] font-bold tracking-wide flex items-center gap-2 font-sans shadow-lg">
        <span className="w-1.5 h-1.5 rounded-full bg-[#00C805] animate-pulse flex-shrink-0" />
        80+ markets
      </div>
    </div>
  );
}
