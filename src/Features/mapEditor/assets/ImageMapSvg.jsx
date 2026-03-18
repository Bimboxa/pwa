import { Box } from "@mui/material";

export default function ImageMapSvg({ className }) {
  return (
    <Box
      className={className}
      sx={{
        width: 1,
        height: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        "& svg": {
          width: "100%",
          height: "100%",
        },
      }}
    >
      <svg
        viewBox="0 0 1024 768"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Grid lines */}
        <g className="grid-lines" stroke="currentColor" strokeWidth="1" opacity="0.15">
          <line x1="280" y1="80" x2="280" y2="680" />
          <line x1="530" y1="80" x2="530" y2="680" />
          <line x1="680" y1="80" x2="680" y2="680" />
          <line x1="130" y1="220" x2="900" y2="220" />
          <line x1="130" y1="430" x2="900" y2="430" />
          <line x1="130" y1="580" x2="900" y2="580" />
        </g>

        {/* Walls - thick */}
        <g className="walls" stroke="currentColor" strokeWidth="18" strokeLinecap="square" opacity="0.3">
          {/* Outer polygon (right angled shape) */}
          <polyline points="210,180 210,600 870,600 870,180 530,180" />
          {/* Right wall angled */}
          <line x1="870" y1="180" x2="770" y2="600" />

          {/* Top left return */}
          <line x1="210" y1="180" x2="350" y2="180" />
          {/* Gap for door */}
          <line x1="390" y1="180" x2="530" y2="180" />

          {/* Inner horizontal wall top */}
          <line x1="530" y1="180" x2="530" y2="430" />

          {/* Small room walls */}
          <line x1="350" y1="300" x2="500" y2="300" />
          <line x1="350" y1="370" x2="500" y2="370" />

          {/* Small square room */}
          <line x1="310" y1="430" x2="310" y2="530" />
          <line x1="310" y1="530" x2="430" y2="530" />
          <line x1="430" y1="530" x2="430" y2="430" />

          {/* Left protrusion */}
          <line x1="160" y1="350" x2="160" y2="500" />
          <line x1="160" y1="350" x2="195" y2="350" />
          <line x1="160" y1="500" x2="195" y2="500" />

          {/* Small notch top left */}
          <line x1="350" y1="180" x2="350" y2="210" />
          <line x1="370" y1="210" x2="370" y2="240" />
        </g>
      </svg>
    </Box>
  );
}
