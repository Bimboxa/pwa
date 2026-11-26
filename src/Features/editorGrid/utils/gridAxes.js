// Frame of the editor grid, in base-map local px (SVG: y down).
//
// - origin: the CENTRE of the base map — the centre axes drawn by the grid
//   layer are the u = 0 and v = 0 lines, so they always lie on main lines
//   and on snap nodes;
// - direction: the ortho snap angle of the editor
//   (mapEditor.orthoSnapAngleOffset, degrees). Same convention as
//   snapToAngle / the rotated crosshair: a positive angle turns the frame
//   counter-clockwise on screen, i.e. the u axis points at −angle in SVG
//   coordinates. The grid lines are then parallel to the directions the
//   Shift ortho constraint snaps to.
//
// Grid lines: u = i × cell and v = j × cell.
export function getGridAxes({ imageSize, angleDeg = 0 }) {
  const phi = (-(Number(angleDeg) || 0) * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  return {
    ox: (imageSize?.width ?? 0) / 2,
    oy: (imageSize?.height ?? 0) / 2,
    ux: cos,
    uy: sin,
    vx: -sin,
    vy: cos,
  };
}

// local px → grid coordinates
export function toGrid(axes, point) {
  const dx = point.x - axes.ox;
  const dy = point.y - axes.oy;
  return {
    u: dx * axes.ux + dy * axes.uy,
    v: dx * axes.vx + dy * axes.vy,
  };
}

// grid coordinates → local px
export function fromGrid(axes, u, v) {
  return {
    x: axes.ox + u * axes.ux + v * axes.vx,
    y: axes.oy + u * axes.uy + v * axes.vy,
  };
}
