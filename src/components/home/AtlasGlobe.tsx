"use client";

/* ── Covered markets plotted on the globe ───────────────────────────
   Hero cities pulse and carry floating score cards; the rest render
   as small fixed dots so the coverage of both countries reads at a
   glance. Coordinates are hand-placed inside the USA / UK landmasses. */

const HERO_CITIES = [
  { id: "lon", cx: 263, cy: 157 }, // London
  { id: "nyc", cx: 167, cy: 172 }, // New York
  { id: "man", cx: 259, cy: 146 }, // Manchester
  { id: "mia", cx: 162, cy: 213 }, // Miami
] as const;

const DOT_CITIES = [
  // USA
  { id: "bos", cx: 170, cy: 166 }, // Boston
  { id: "chi", cx: 140, cy: 164 }, // Chicago
  { id: "aus", cx: 124, cy: 199 }, // Austin
  { id: "sea", cx: 99,  cy: 154 }, // Seattle
  { id: "sfo", cx: 92,  cy: 178 }, // San Francisco
  { id: "lax", cx: 94,  cy: 190 }, // Los Angeles
  // UK
  { id: "edi", cx: 259, cy: 136 }, // Edinburgh
  { id: "lds", cx: 261, cy: 144 }, // Leeds
  { id: "bir", cx: 259, cy: 151 }, // Birmingham
  { id: "bri", cx: 256, cy: 155 }, // Bristol
  { id: "cam", cx: 265, cy: 152 }, // Cambridge
] as const;

/* ── Simplified Atlantic-centred world map ──────────────────────────
   Neutral landmasses give geographic context; the USA and UK are
   drawn as their own shapes and highlighted in brand green. */

const NEUTRAL_LAND = [
  // Canada (above the US border) + Hudson Bay notch
  "M 84,134 L 78,116 L 86,100 L 122,88 L 150,86 L 172,94 L 196,108 L 191,130 L 178,146 L 172,157 L 140,155 L 96,149 Z",
  // Alaska
  "M 58,110 L 74,102 L 80,114 L 70,124 L 58,120 Z",
  // Greenland
  "M 202,72 L 222,62 L 237,74 L 231,96 L 213,102 L 201,89 Z",
  // Mexico + Central America taper
  "M 93,196 L 108,201 L 120,208 L 132,212 L 128,222 L 138,232 L 148,242 L 141,246 L 126,236 L 112,220 L 100,208 Z",
  // South America
  "M 150,248 L 180,240 L 198,259 L 194,296 L 176,326 L 155,330 L 141,306 L 139,273 Z",
  // Ireland
  "M 240,145 L 246,142 L 248,149 L 244,155 L 238,152 Z",
  // Continental Europe (Iberia → France → Central)
  "M 262,167 L 281,159 L 299,163 L 311,153 L 329,156 L 335,168 L 321,178 L 299,183 L 279,185 L 265,179 Z",
  // Scandinavia
  "M 291,106 L 306,95 L 319,103 L 315,127 L 301,139 L 292,125 Z",
  // Africa
  "M 268,193 L 296,187 L 322,201 L 330,241 L 314,281 L 288,305 L 262,299 L 248,267 L 250,229 Z",
  // Western Asia edge
  "M 340,111 L 400,99 L 448,119 L 452,151 L 430,173 L 390,179 L 352,171 L 338,145 Z",
];

// USA lower-48: west coast, Gulf curve, Florida peninsula, east coast
const USA_PATH =
  "M 96,150 L 140,156 L 171,158 L 168,170 L 171,183 L 164,196 L 156,204 " +
  "L 161,211 L 166,221 L 160,218 L 154,208 L 146,206 L 132,210 L 124,206 " +
  "L 114,203 L 104,198 L 93,193 L 88,178 L 91,162 Z";

// Great Britain: Scotland wide at top, Wales notch, Kent corner
const UK_PATH =
  "M 257,130 L 262,126 L 261,134 L 266,139 L 264,148 L 268,156 L 262,162 " +
  "L 256,159 L 258,151 L 253,146 L 256,138 Z";

interface AtlasGlobeProps {
  /** Live count of covered markets (municipalities) from the database */
  marketCount?: number;
}

export function AtlasGlobe({ marketCount = 32 }: AtlasGlobeProps) {
  return (
    <div className="relative w-full max-w-[580px] mx-auto select-none" aria-hidden="true">

      {/* ── SVG globe ── */}
      <svg viewBox="0 0 500 500" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <clipPath id="gc">
            <circle cx="250" cy="250" r="218" />
          </clipPath>
          <radialGradient id="gg" cx="38%" cy="32%" r="68%">
            <stop offset="0%" stopColor="#1c1c1f" />
            <stop offset="100%" stopColor="#0f0f11" />
          </radialGradient>
        </defs>

        {/* Drop shadow */}
        <ellipse cx="253" cy="258" rx="214" ry="214" fill="rgba(0,0,0,0.5)" />

        {/* Globe sphere */}
        <circle cx="250" cy="250" r="218" fill="url(#gg)" />

        {/* Clipped interior */}
        <g clipPath="url(#gc)">

          {/* Graticule */}
          <g stroke="#2a2a30" strokeWidth="0.7" fill="none" opacity="0.6">
            <line x1="32"  y1="130" x2="468" y2="130" />
            <line x1="32"  y1="178" x2="468" y2="178" />
            <line x1="32"  y1="250" x2="468" y2="250" />
            <line x1="32"  y1="322" x2="468" y2="322" />
            <line x1="32"  y1="370" x2="468" y2="370" />
            <line x1="105" y1="32"  x2="105" y2="468" />
            <line x1="178" y1="32"  x2="178" y2="468" />
            <line x1="250" y1="32"  x2="250" y2="468" />
            <line x1="322" y1="32"  x2="322" y2="468" />
            <line x1="395" y1="32"  x2="395" y2="468" />
          </g>

          {/* Neutral landmasses */}
          <g fill="#26262c" opacity="0.75">
            {NEUTRAL_LAND.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>

          {/* Covered countries — brand highlight */}
          <path d={USA_PATH} fill="#00C805" opacity="0.18" stroke="#00A804" strokeWidth="1.3" />
          <path d={UK_PATH}  fill="#00C805" opacity="0.22" stroke="#00A804" strokeWidth="1.3" />

          {/* Country labels */}
          <text x="122" y="182" fontSize="13" fontWeight="800" letterSpacing="2.5" fill="#a1a1aa" opacity="0.85" fontFamily="ui-sans-serif, system-ui">USA</text>
          <text x="274" y="134" fontSize="11" fontWeight="800" letterSpacing="2" fill="#a1a1aa" opacity="0.85" fontFamily="ui-sans-serif, system-ui">UK</text>
          <line x1="271" y1="139" x2="265" y2="142" stroke="#a1a1aa" strokeWidth="0.8" opacity="0.5" />

          {/* Subtle sphere highlight */}
          <circle cx="200" cy="180" r="120" fill="white" opacity="0.07" />
        </g>

        {/* Globe border */}
        <circle cx="250" cy="250" r="218" fill="none" stroke="#2f2f36" strokeWidth="1.5" />

        {/* ── Secondary market dots ── */}
        {DOT_CITIES.map((c) => (
          <g key={c.id}>
            <circle cx={c.cx} cy={c.cy} r="2.6" fill="#00C805" opacity="0.55" />
            <circle cx={c.cx} cy={c.cy} r="1.2" fill="#0B3D0B" opacity="0.7" />
          </g>
        ))}

        {/* ── Hero city dots (pulsing) ── */}
        {HERO_CITIES.map((city, i) => (
          <g key={city.id}>
            <circle cx={city.cx} cy={city.cy} r="6" fill="#00C805" opacity="0.3">
              <animate attributeName="r" values="5;18;5" dur="2.6s" repeatCount="indefinite" begin={`${i * 0.55}s`} />
              <animate attributeName="opacity" values="0.4;0;0.4" dur="2.6s" repeatCount="indefinite" begin={`${i * 0.55}s`} />
            </circle>
            <circle cx={city.cx} cy={city.cy} r="6" fill="#00C805" opacity="0.2" />
            <circle cx={city.cx} cy={city.cy} r="4" fill="#00C805" />
            <circle cx={city.cx} cy={city.cy} r="2" fill="#CCFF00" />
          </g>
        ))}
      </svg>

      {/* ── Floating score cards ── */}

      {/* London — upper right */}
      <div className="absolute top-[14%] right-[2%] glass-panel rounded-2xl px-4 py-3 shadow-md">
        <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest">LONDON · UK</p>
        <p className="text-3xl font-black tracking-tight tabular-nums text-foreground leading-none mt-0.5">87</p>
        <p className="text-[9px] font-semibold uppercase tracking-widest mt-1" style={{ color: "#00C805" }}>↑ High conviction</p>
      </div>

      {/* New York — left middle */}
      <div className="absolute top-[38%] -left-[4%] glass-panel rounded-2xl px-4 py-3 shadow-md">
        <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest">NEW YORK · US</p>
        <p className="text-3xl font-black tracking-tight tabular-nums text-foreground leading-none mt-0.5">83</p>
        <p className="text-[9px] font-semibold uppercase tracking-widest mt-1" style={{ color: "#00C805" }}>↑ Growing fast</p>
      </div>

      {/* Manchester — lower right */}
      <div className="absolute bottom-[18%] right-[4%] glass-panel rounded-2xl px-4 py-3 shadow-md">
        <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest">MANCHESTER · UK</p>
        <p className="text-3xl font-black tracking-tight tabular-nums text-foreground leading-none mt-0.5">78</p>
        <p className="text-[9px] font-semibold uppercase tracking-widest mt-1" style={{ color: "#00C805" }}>↑ BTR pipeline</p>
      </div>

      {/* Market count badge — live from DB */}
      <div className="absolute bottom-[5%] left-[12%] bg-secondary border border-border text-foreground rounded-full px-4 py-1.5 text-[11px] font-bold tracking-wide flex items-center gap-2 font-sans shadow-lg">
        <span className="w-1.5 h-1.5 rounded-full bg-[#00C805] animate-pulse flex-shrink-0" />
        {marketCount} markets · 🇺🇸 USA &amp; 🇬🇧 UK
      </div>
    </div>
  );
}
