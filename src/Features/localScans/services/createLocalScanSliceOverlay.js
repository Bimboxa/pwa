import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineLoop,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  Points,
  ShaderMaterial,
  DoubleSide,
} from "three";

// Reuse the scan's geometry: no second upload of tens of millions of vertices.
// The fragment overlay marks only points within the two boundary bands.
export default function createLocalScanSliceOverlay(editor, view, frame) {
  const uniforms = {
    lower: { value: frame.min[2] },
    upper: { value: frame.max[2] },
    tolerance: { value: 0.02 },
    pointSize: { value: 3 * editor.sceneManager.renderer.getPixelRatio() },
  };
  const pointMaterial = new ShaderMaterial({
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    vertexShader: `
      uniform float lower;
      uniform float upper;
      uniform float tolerance;
      uniform float pointSize;
      varying float boundary;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        float lo = abs(world.y - lower);
        float hi = abs(world.y - upper);
        boundary = lo <= hi ? 0.0 : 1.0;
        gl_Position = projectionMatrix * viewMatrix * world;
        gl_PointSize = pointSize;
        if (min(lo, hi) > tolerance) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      }
    `,
    fragmentShader: `
      varying float boundary;
      void main() {
        if (length(gl_PointCoord - vec2(0.5)) > 0.5) discard;
        gl_FragColor = vec4(mix(vec3(1.0, 0.38, 0.05), vec3(0.0, 0.85, 1.0), boundary), 0.95);
      }
    `,
  });
  const points = new Points(view.pointGeometry, pointMaterial);
  points.visible = false;
  points.renderOrder = 10002;
  points.raycast = () => false;
  view.root.add(points);
  const group = new Group();
  group.userData.isDecor = true;
  group.raycast = () => false;
  editor.sceneManager.scene.add(group);
  const vertices = [
    [frame.min[0], frame.min[1]],
    [frame.max[0], frame.min[1]],
    [frame.max[0], frame.max[1]],
    [frame.min[0], frame.max[1]],
  ].flatMap(([x, y]) => [
    frame.xDirection[0] * x + frame.yDirection[0] * y,
    0,
    frame.xDirection[2] * x + frame.yDirection[2] * y,
  ]);
  const planes = [0xff610d, 0x00d9ff].map((color) => {
    const plane = new Group();
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    const outline = new LineLoop(
      geometry,
      new LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.8,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      })
    );
    outline.renderOrder = 10001;
    const fillGeometry = geometry.clone();
    fillGeometry.setIndex([0, 1, 2, 0, 2, 3]);
    const fill = new Mesh(
      fillGeometry,
      new MeshBasicMaterial({
        color,
        side: DoubleSide,
        transparent: true,
        opacity: 0.04,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      })
    );
    fill.renderOrder = 10000;
    plane.add(outline, fill);
    group.add(plane);
    return plane;
  });
  return {
    setHighlight(visible) {
      if (points.visible === visible) return;
      points.visible = visible;
      editor.requestRender();
    },
    setRange(lower, upper, tolerance) {
      uniforms.lower.value = lower;
      uniforms.upper.value = upper;
      uniforms.tolerance.value = tolerance;
      planes[0].position.y = lower;
      planes[1].position.y = upper;
      editor.requestRender();
    },
    dispose() {
      points.removeFromParent();
      pointMaterial.dispose(); // The scan owns and disposes the shared geometry.
      group.removeFromParent();
      for (const plane of planes)
        for (const object of plane.children) {
          object.geometry.dispose();
          object.material.dispose();
        }
      editor.requestRender();
    },
  };
}
