import { forwardRef } from "react";

const RING_RADIUS_PX = 11;
const TICKS_PATH = "M-24 0 H-15 M15 0 H24 M0 -24 V-15 M0 15 V24";
const HALO = "rgba(0, 0, 0, 0.6)";

// Target drawn where the pointer ray meets a SCENE_3D scan: a fixed-size
// screen-space reticle (white with a dark halo — readable on any aerial
// texture, where the regular thin snap circle gets lost). An SVG <g> to put
// in a drawing overlay; hidden until moved by updateScene3dPickReticle
// (utils).
const Scene3dPickReticle = forwardRef(function Scene3dPickReticle(
  { color = "#ff6d00" },
  ref
) {
  return (
    <g ref={ref} style={{ display: "none", pointerEvents: "none" }}>
      <circle r={RING_RADIUS_PX} fill="none" stroke={HALO} strokeWidth={5} />
      <path
        d={TICKS_PATH}
        stroke={HALO}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <circle r={RING_RADIUS_PX} fill="none" stroke="#fff" strokeWidth={2.5} />
      <path
        d={TICKS_PATH}
        stroke="#fff"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <circle r={3} fill={color} stroke="#fff" strokeWidth={1} />
    </g>
  );
});

export default Scene3dPickReticle;
