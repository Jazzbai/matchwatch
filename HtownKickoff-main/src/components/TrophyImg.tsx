import React from "react";

/**
 * Neutral, hand-drawn championship trophy (not the official tournament emblem).
 * Used as the World Cup 2026 hero graphic in place of trademarked artwork.
 */
export const TrophyImg = () => (
  <svg viewBox="0 0 200 300" fill="none" xmlns="http://www.w3.org/2000/svg"
    style={{ width: "100%", maxWidth: 240, height: "auto",
             filter: "drop-shadow(0 0 28px rgba(212,160,20,0.65)) drop-shadow(0 0 70px rgba(212,140,10,0.30))" }}>
    <defs>
      <linearGradient id="gBody" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"   stopColor="#5A3600"/>
        <stop offset="12%"  stopColor="#C07800"/>
        <stop offset="38%"  stopColor="#FAE870"/>
        <stop offset="62%"  stopColor="#E0A010"/>
        <stop offset="88%"  stopColor="#A06000"/>
        <stop offset="100%" stopColor="#5A3600"/>
      </linearGradient>
      <linearGradient id="gBase" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"   stopColor="#FFF0A0"/>
        <stop offset="35%"  stopColor="#D4A017"/>
        <stop offset="100%" stopColor="#7A5000"/>
      </linearGradient>
      <linearGradient id="gGreen" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"   stopColor="#032010"/>
        <stop offset="50%"  stopColor="#176B40"/>
        <stop offset="100%" stopColor="#032010"/>
      </linearGradient>
      <radialGradient id="gGlobe" cx="34%" cy="28%" r="68%">
        <stop offset="0%"   stopColor="#FFF4B0"/>
        <stop offset="30%"  stopColor="#E8B020"/>
        <stop offset="70%"  stopColor="#A07010"/>
        <stop offset="100%" stopColor="#4A2C00"/>
      </radialGradient>
      <filter id="glow">
        <feGaussianBlur stdDeviation="3" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>

    {/* ── BODY — left arm ─ waist ─ hip (globe drawn on top) ── */}
    <path d="
      M 86 76
      C 68 82 38 90 26 104
      C 16 118 50 138 73 158
      C 80 172 50 190 48 206
      L 44 220  L 156 220
      L 152 206
      C 150 190 120 172 127 158
      C 150 138 184 118 174 104
      C 162 90 132 82 114 76
      Z
    " fill="url(#gBody)"/>

    {/* left edge darkening */}
    <path d="M 86 76 C 68 82 38 90 26 104 C 16 118 50 138 73 158 C 80 172 50 190 48 206"
          stroke="rgba(40,20,0,0.55)" strokeWidth="7" strokeLinecap="round" fill="none"/>
    {/* right edge darkening */}
    <path d="M 114 76 C 132 82 162 90 174 104 C 184 118 150 138 127 158 C 120 172 150 190 152 206"
          stroke="rgba(40,20,0,0.55)" strokeWidth="7" strokeLinecap="round" fill="none"/>

    {/* inner left highlight (3-D curve feel) */}
    <path d="M 83 82 C 66 90 52 108 68 148 C 72 162 58 182 56 204"
          stroke="rgba(255,240,140,0.22)" strokeWidth="8" strokeLinecap="round" fill="none"/>
    {/* centre highlight stripe */}
    <path d="M 100 86 L 100 218"
          stroke="rgba(255,248,180,0.50)" strokeWidth="14" strokeLinecap="round" fill="none"/>

    {/* arm-level guide line */}
    <path d="M 32 108 C 55 100 100 98 145 100 C 159 104 168 108 166 108"
          stroke="rgba(80,45,0,0.50)" strokeWidth="1.8" fill="none"/>
    {/* waist guide line */}
    <path d="M 56 154 C 72 147 100 145 128 147 C 140 151 146 155 144 155"
          stroke="rgba(80,45,0,0.50)" strokeWidth="1.8" fill="none"/>
    {/* hip guide line */}
    <path d="M 52 198 C 68 192 100 190 132 192 C 144 196 152 200 150 200"
          stroke="rgba(80,45,0,0.50)" strokeWidth="1.8" fill="none"/>

    {/* ── PEDESTAL COLLAR (gold) ── */}
    <rect x="40" y="218" width="120" height="14" rx="2" fill="url(#gBase)"/>
    <rect x="40" y="218" width="120" height="3"  fill="rgba(255,248,140,0.50)"/>

    {/* ── MALACHITE BASE ── */}
    <rect x="20" y="232" width="160" height="32" rx="3" fill="url(#gGreen)"/>
    <rect x="18" y="230" width="164" height="6"  rx="1" fill="url(#gBase)"/>
    <rect x="18" y="262" width="164" height="5"  rx="1" fill="url(#gBase)"/>

    {/* ── inscription ── */}
    <rect x="16" y="267" width="168" height="13" rx="1" fill="url(#gBase)"/>
    <text x="100" y="278" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="700"
          fontSize="7" fill="#3A2000" letterSpacing="2">WORLD CUP 2026</text>

    {/* ── BOTTOM BASE ── */}
    <rect x="8"  y="278" width="184" height="18" rx="4" fill="url(#gBase)"/>
    <rect x="8"  y="278" width="184" height="4"  fill="rgba(255,248,140,0.50)"/>

    {/* ── GLOBE — painted last so it rests ON TOP of the raised arms ── */}
    <circle cx="100" cy="46" r="36" fill="url(#gGlobe)" filter="url(#glow)"/>
    {/* specular highlight */}
    <ellipse cx="87" cy="34" rx="11" ry="8" fill="rgba(255,252,210,0.42)" transform="rotate(-28,87,34)"/>
    {/* latitude arcs */}
    <path d="M 66 46 Q 100 36 134 46" stroke="rgba(0,0,0,0.22)" strokeWidth="1.2" fill="none"/>
    <path d="M 68 58 Q 100 50 132 58" stroke="rgba(0,0,0,0.15)" strokeWidth="1"   fill="none"/>
    <path d="M 68 34 Q 100 26 132 34" stroke="rgba(0,0,0,0.15)" strokeWidth="1"   fill="none"/>
    {/* longitude arcs */}
    <path d="M 100 10 Q 92 28 100 46 Q 108 64 100 82"  stroke="rgba(0,0,0,0.22)" strokeWidth="1.2" fill="none"/>
    <path d="M 82  14 Q 76 32 82  46 Q 88 60 84  80"   stroke="rgba(0,0,0,0.14)" strokeWidth="1"   fill="none"/>
    <path d="M 118 14 Q 124 32 118 46 Q 112 60 116 80" stroke="rgba(0,0,0,0.14)" strokeWidth="1"   fill="none"/>
    {/* continent blobs */}
    <ellipse cx="88"  cy="40" rx="9" ry="6"  fill="rgba(0,0,0,0.14)" transform="rotate(-15,88,40)"/>
    <ellipse cx="113" cy="44" rx="7" ry="5"  fill="rgba(0,0,0,0.12)" transform="rotate(10,113,44)"/>
    <ellipse cx="96"  cy="57" rx="5" ry="3.5" fill="rgba(0,0,0,0.10)"/>
    <ellipse cx="76"  cy="52" rx="4" ry="3"  fill="rgba(0,0,0,0.09)" transform="rotate(-8,76,52)"/>
  </svg>
);
