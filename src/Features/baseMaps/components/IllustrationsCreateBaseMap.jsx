// Inline SVG thumbnails for the create-baseMap option cards.

const GRID = "#e9e7ee";
const LIGHT = "#d5d2da";
const STROKE = "#8b8794";

function SvgFrame({ children, bgcolor }) {
  return (
    <svg
      viewBox="0 0 172 110"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      style={{ display: "block", background: bgcolor ?? "transparent" }}
    >
      {children}
    </svg>
  );
}

function GridLines({ step = 20, color = GRID }) {
  const vLines = [];
  const hLines = [];
  for (let x = step; x < 172; x += step) {
    vLines.push(<line key={`v${x}`} x1={x} y1={0} x2={x} y2={110} />);
  }
  for (let y = step; y < 110; y += step) {
    hLines.push(<line key={`h${y}`} x1={0} y1={y} x2={172} y2={y} />);
  }
  return (
    <g stroke={color} strokeWidth="1">
      {vLines}
      {hLines}
    </g>
  );
}

export function IllustrationDwg() {
  return (
    <SvgFrame>
      <GridLines />
      <g stroke={STROKE} fill="none">
        <rect x="36" y="22" width="100" height="66" strokeWidth="4" />
        <line x1="88" y1="22" x2="88" y2="52" strokeWidth="3" />
        <line x1="36" y1="52" x2="70" y2="52" strokeWidth="3" />
        <line x1="102" y1="52" x2="136" y2="52" strokeWidth="3" />
        <line x1="60" y1="52" x2="60" y2="88" strokeWidth="3" />
      </g>
    </SvgFrame>
  );
}

export function IllustrationPdf() {
  return (
    <SvgFrame>
      <rect
        x="56"
        y="12"
        width="60"
        height="86"
        fill="#fff"
        stroke={LIGHT}
        strokeWidth="2"
      />
      <g stroke={LIGHT} strokeWidth="3" strokeLinecap="round">
        <line x1="64" y1="26" x2="102" y2="26" />
        <line x1="64" y1="34" x2="94" y2="34" />
        <line x1="64" y1="42" x2="100" y2="42" />
      </g>
      <rect
        x="64"
        y="52"
        width="34"
        height="34"
        fill="none"
        stroke={STROKE}
        strokeWidth="2"
      />
    </SvgFrame>
  );
}

export function IllustrationImage() {
  return (
    <SvgFrame bgcolor="#f4f1f5">
      <g stroke="#e2dde6" strokeWidth="10">
        <line x1="-20" y1="110" x2="90" y2="-20" />
        <line x1="20" y1="130" x2="130" y2="0" />
        <line x1="60" y1="150" x2="170" y2="20" />
        <line x1="100" y1="170" x2="210" y2="40" />
      </g>
      <circle cx="86" cy="55" r="12" fill={LIGHT} />
    </SvgFrame>
  );
}

export function IllustrationBlankPage() {
  return (
    <SvgFrame>
      <GridLines step={14} />
    </SvgFrame>
  );
}

export function IllustrationSatellite() {
  return (
    <SvgFrame bgcolor="#ccd8c3">
      <rect x="0" y="48" width="172" height="14" fill="#b9c7ae" />
      <rect x="34" y="24" width="20" height="12" fill="#f4f2ee" />
      <rect x="112" y="72" width="24" height="14" fill="#f4f2ee" />
      <line
        x1="0"
        y1="20"
        x2="172"
        y2="34"
        stroke="#b9c7ae"
        strokeWidth="4"
      />
    </SvgFrame>
  );
}
