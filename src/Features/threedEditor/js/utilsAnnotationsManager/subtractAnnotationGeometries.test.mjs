import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../.."
);

// Bundle the real carve with its own copy of three (a data: URL import
// resolves no bare specifier): the scene objects of the tests are built from
// THAT copy, so Brush / Matrix4 and the test meshes agree.
const bundle = await build({
  stdin: {
    contents: `
      export { default as subtractAnnotationGeometries } from "Features/threedEditor/js/utilsAnnotationsManager/subtractAnnotationGeometries";
      export { default as buildMergedWorldSolid } from "Features/threedEditor/js/utilsAnnotationsManager/buildMergedWorldSolid";
      export { default as extrudePolylineWall } from "Features/threedEditor/js/utilsAnnotationsManager/extrudePolylineWall";
      export { getSoupArea, toNonIndexedArea } from "Features/threedEditor/js/utilsAnnotationsManager/getSoupMeasures";
      export { getSolidMeshesFromObject3D, hasCarvedSolid } from "Features/threedEditor/js/utilsAnnotationsManager/getSolidMeshFromObject3D";
      export { default as buildMesh3dFromCarvedTriangles } from "Features/annotationMesh3d/utils/buildMesh3dFromCarvedTriangles";
      export { default as isMesh3dClosed } from "Features/annotationMesh3d/utils/isMesh3dClosed";
      export { getMesh3dSignedVolume } from "Features/annotationMesh3d/utils/getMesh3dQties";
      export * as THREE from "three";
    `,
    resolveDir: root,
    loader: "js",
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  plugins: [
    {
      name: "aliases",
      setup(b) {
        b.onResolve({ filter: /^Features\// }, (args) => ({
          path: path.join(
            root,
            "src",
            args.path.endsWith(".js") ? args.path : args.path + ".js"
          ),
        }));
      },
    },
  ],
});
const {
  subtractAnnotationGeometries,
  buildMergedWorldSolid,
  extrudePolylineWall,
  getSoupArea,
  toNonIndexedArea,
  getSolidMeshesFromObject3D,
  hasCarvedSolid,
  buildMesh3dFromCarvedTriangles,
  isMesh3dClosed,
  getMesh3dSignedVolume,
  THREE,
} = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

const {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
} = THREE;

// A mesh3d annotation object as buildMesh3dAnnotationObject emits it: one
// Mesh per face of a unit cube (role SOLID + mesh3dFaceIndex), the face-loop
// edge lines, and the group flags.
function mesh3dCube({ size = 1, closed = true, nodeId = "m" } = {}) {
  const box = new BoxGeometry(size, size, size).toNonIndexed();
  const positions = box.getAttribute("position").array;
  const material = new MeshBasicMaterial();
  const group = new Group();
  // BoxGeometry: 6 faces × 2 triangles × 3 vertices, in face order.
  for (let face = 0; face < 6; face++) {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(positions.slice(face * 18, face * 18 + 18), 3)
    );
    geometry.computeVertexNormals();
    const mesh = new Mesh(geometry, material);
    mesh.userData = { role: "SOLID", mesh3dFaceIndex: face };
    group.add(mesh);
  }
  const edges = new LineSegments(
    new BufferGeometry(),
    new LineBasicMaterial({ color: 0x000000 })
  );
  edges.userData = {
    isGridEdge: true,
    gridEdgeKind: "MESH3D",
    mesh3dEdges: [],
  };
  group.add(edges);
  group.userData = {
    isAnnotationMesh3d: true,
    mesh3dLift: 0,
    mesh3dClosed: closed,
    nodeId,
  };
  return group;
}

function solidBox(w, h, d) {
  const mesh = new Mesh(new BoxGeometry(w, h, d), new MeshBasicMaterial());
  mesh.userData = { role: "SOLID" };
  return mesh;
}

// Both operands parented in a posed base map group, as the scene does.
function frame() {
  const baseMapGroup = new Group();
  baseMapGroup.position.set(5, -3, 2);
  baseMapGroup.rotation.z = Math.PI / 5;
  return baseMapGroup;
}

// The carved solid, read as a closed face mesh in the solid's LOCAL frame.
function carvedMesh(solid) {
  // The evaluator output is indexed: read it as a triangle soup.
  const geometry = solid.geometry.index
    ? solid.geometry.toNonIndexed()
    : solid.geometry;
  const mesh = buildMesh3dFromCarvedTriangles({
    positions: Array.from(geometry.getAttribute("position").array),
  });
  assert.ok(mesh, "the carved soup reads as a face mesh");
  return mesh;
}

test("a mesh3d host is collapsed into one carved solid", () => {
  const baseMapGroup = frame();
  const host = mesh3dCube();
  const cutter = solidBox(0.4, 0.4, 3);
  baseMapGroup.add(host);
  baseMapGroup.add(cutter);
  baseMapGroup.updateMatrixWorld(true);
  const material = host.children[0].material;

  subtractAnnotationGeometries(host, [cutter], { rebuildEdges: true });

  const solids = getSolidMeshesFromObject3D(host);
  assert.equal(solids.length, 1);
  assert.equal(hasCarvedSolid(host), true);
  assert.equal(solids[0].material, material, "the faces' material is kept");
  assert.equal(solids[0].userData.mesh3dFaceIndex, undefined);
  host.traverse((child) => {
    assert.equal(child.userData?.mesh3dFaceIndex, undefined);
  });
  const edgeLines = [];
  host.traverse((child) => {
    if (child.userData?.isGridEdge) edgeLines.push(child);
  });
  assert.equal(edgeLines.length, 1);
  assert.equal(edgeLines[0].userData.gridEdgeKind, "EDGES");
  assert.equal(edgeLines[0].userData.mesh3dEdges, undefined);

  // Local frame kept: the carved solid is a closed cube minus the column.
  const mesh = carvedMesh(solids[0]);
  assert.equal(isMesh3dClosed(mesh), true);
  const volume = Math.abs(getMesh3dSignedVolume(mesh));
  assert.ok(Math.abs(volume - (1 - 0.4 * 0.4 * 1)) < 1e-3, `volume ${volume}`);
  // Still in the group's local frame (centered on the origin), not world.
  solids[0].geometry.computeBoundingBox();
  const { min, max } = solids[0].geometry.boundingBox;
  assert.ok(Math.abs(min.x + 0.5) < 1e-4 && Math.abs(max.x - 0.5) < 1e-4);
});

test("a closed mesh3d cutter is merged into one brush", () => {
  const baseMapGroup = frame();
  const host = solidBox(2, 2, 2);
  const cutter = mesh3dCube({ size: 0.5 });
  cutter.position.set(0, 0, 1); // half in, half out of the host
  baseMapGroup.add(host);
  baseMapGroup.add(cutter);
  baseMapGroup.updateMatrixWorld(true);

  subtractAnnotationGeometries(host, [cutter]);

  assert.equal(hasCarvedSolid(host), true);
  const mesh = carvedMesh(host);
  assert.equal(isMesh3dClosed(mesh), true);
  const volume = Math.abs(getMesh3dSignedVolume(mesh));
  assert.ok(
    Math.abs(volume - (8 - 0.5 * 0.5 * 0.25)) < 1e-3,
    `volume ${volume}`
  );
  // The cutter's own faces are untouched.
  assert.equal(getSolidMeshesFromObject3D(cutter).length, 6);
});

test("an open mesh3d cutter is skipped", () => {
  const baseMapGroup = frame();
  const host = solidBox(2, 2, 2);
  const cutter = mesh3dCube({ size: 0.5, closed: false });
  baseMapGroup.add(host);
  baseMapGroup.add(cutter);
  baseMapGroup.updateMatrixWorld(true);
  const geometry = host.geometry;
  const warn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args);
  try {
    subtractAnnotationGeometries(host, [cutter]);
  } finally {
    console.warn = warn;
  }
  assert.equal(hasCarvedSolid(host), false);
  assert.equal(host.geometry, geometry);
  assert.equal(warnings.length, 1);
});

// A PX polyline wall as createAnnotationObject3D builds it: one zero-thickness
// quad per segment (an L of two 2 x 3 m quads), merged into one world brush
// like the permanent bake does.
function sheetWallBrush(baseMapGroup) {
  const wall = extrudePolylineWall(
    [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
    ],
    3,
    new MeshBasicMaterial(),
    false
  );
  baseMapGroup.add(wall);
  // A 1 m cube through the first quad only: a 1 x 1 m window.
  const cutter = solidBox(1, 1, 1);
  cutter.position.set(1, 0, 1.5);
  baseMapGroup.add(cutter);
  baseMapGroup.updateMatrixWorld(true);
  return { solid: buildMergedWorldSolid(wall), cutter };
}

test("a PX polyline wall is clipped as an open sheet (hollow)", () => {
  const { solid, cutter } = sheetWallBrush(frame());
  const areaBefore = getSoupArea(solid.geometry);
  assert.ok(Math.abs(areaBefore - 12) < 1e-4, `area ${areaBefore}`);

  subtractAnnotationGeometries(solid, [cutter], { hollow: true });

  assert.equal(hasCarvedSolid(solid), true);
  // The window is removed and no cap face of the cutter is added.
  const areaAfter = toNonIndexedArea(solid.geometry);
  assert.ok(Math.abs(areaAfter - 11) < 1e-3, `area ${areaAfter}`);
  // The sheet reads as an OPEN face mesh (the bake writes it with allowOpen).
  const mesh = carvedMesh(solid);
  assert.equal(isMesh3dClosed(mesh), false);
  assert.equal(mesh.faces.length, 2);
});

test("a PX polyline wall carved as a solid never closes", () => {
  const { solid, cutter } = sheetWallBrush(frame());

  subtractAnnotationGeometries(solid, [cutter]);

  // Why the bake must run hollow on a sheet: a regular SUBTRACTION leaves an
  // open soup, which the closed-mesh checks of the bake refuse.
  assert.equal(isMesh3dClosed(carvedMesh(solid)), false);
});

// A PX polyline wall drawn as an arc, as createAnnotationObject3D samples it:
// 18 facets of 30 m radius meeting at 3.3 degrees, extruded over 41.85 m along
// the local Z of a base map posed far from the world origin (float32 noise on
// the world round trip of the carve).
function arcSheetWall() {
  const points = [];
  for (let i = 0; i <= 18; i++) {
    const angle = ((120 - (60 * i) / 18) * Math.PI) / 180;
    points.push({ x: 30 * Math.cos(angle), y: -20 + 30 * Math.sin(angle) });
  }
  const baseMapGroup = new Group();
  baseMapGroup.rotation.set(Math.PI / 2, 0.37, 0);
  baseMapGroup.position.set(512.3, 87.1, 233.7);
  const wall = extrudePolylineWall(
    points,
    41.85,
    new MeshBasicMaterial(),
    false
  );
  baseMapGroup.add(wall);
  // A cylinder across one end of the sheet: every facet is cut along a curve,
  // which leaves slivers and T-junctions on every seam.
  const cutter = new Mesh(
    new CylinderGeometry(25, 25, 80, 48),
    new MeshBasicMaterial()
  );
  cutter.userData.role = "SOLID";
  cutter.rotation.x = Math.PI / 2;
  const scene = new Group();
  scene.add(baseMapGroup, cutter);
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(wall);
  cutter.position.set(
    (box.min.x + box.max.x) / 2 + 3,
    box.max.y + 12,
    (box.min.z + box.max.z) / 2
  );
  scene.updateMatrixWorld(true);
  return { wall, cutter };
}

// Edge segments running along the extrusion (local Z) over more than 5 m:
// the seams between the facets of the arc, and the two free rims.
function countLongitudinalEdges(object) {
  let count = 0;
  object.traverse((child) => {
    if (!child.userData?.isGridEdge) return;
    const position = child.geometry.getAttribute("position");
    for (let i = 0; i < position.count; i += 2) {
      const dx = position.getX(i + 1) - position.getX(i);
      const dy = position.getY(i + 1) - position.getY(i);
      const dz = position.getZ(i + 1) - position.getZ(i);
      const length = Math.hypot(dx, dy, dz);
      if (length > 5 && Math.abs(dz) / length > 0.9) count++;
    }
  });
  return count;
}

test("the seams of a carved arc sheet stay hidden", () => {
  const { wall, cutter } = arcSheetWall();
  // Un-carved: the 17 seams are below the wall threshold, the 2 rims remain.
  assert.equal(countLongitudinalEdges(wall), 2);

  subtractAnnotationGeometries(wall, [cutter], {
    hollow: true,
    rebuildEdges: true,
  });

  assert.equal(hasCarvedSolid(wall), true);
  // Still the 2 rims only: each seam is matched with its twin on the next
  // facet although the carve gave the two copies different end points.
  assert.equal(countLongitudinalEdges(wall), 2);
  // And each facet is read as ONE face, on its own plane.
  const mesh = carvedMesh(getSolidMeshesFromObject3D(wall)[0]);
  assert.equal(mesh.faces.length, 18);
});

// An OPEN mesh3d basin: the unit cube without its +Y face, raised so its
// bottom face lies on y = 0 (bottom + 4 walls, open at the top).
function openBasin() {
  const host = mesh3dCube({ closed: false, nodeId: "basin" });
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z.
  const top = getSolidMeshesFromObject3D(host).find(
    (mesh) => mesh.userData.mesh3dFaceIndex === 2
  );
  host.remove(top);
  host.position.y = 0.5;
  return host;
}

const carvedArea = (object) =>
  getSolidMeshesFromObject3D(object).reduce(
    (sum, mesh) => sum + toNonIndexedArea(mesh.geometry),
    0
  );

test("a cutter touching an open sheet cuts the coplanar face", () => {
  const baseMapGroup = frame();
  const host = openBasin();
  // A pit under the basin: its top face (y = 0) is coplanar with the basin
  // floor, 0.4 × 0.4 inside the 1 × 1 floor.
  const cutter = solidBox(0.4, 1, 0.4);
  cutter.position.y = -0.5;
  baseMapGroup.add(host);
  baseMapGroup.add(cutter);
  baseMapGroup.updateMatrixWorld(true);

  assert.ok(Math.abs(carvedArea(host) - 5) < 1e-6);
  subtractAnnotationGeometries(host, [cutter], { hollow: true });
  // The floor keeps 1 − 0.16 m²: the pit footprint is cut out of the
  // coplanar face (HOLLOW_SUBTRACTION alone keeps a random half of it).
  const area = carvedArea(host);
  assert.ok(Math.abs(area - (5 - 0.16)) < 1e-4, `area ${area}`);
  // Nothing else moved: the carved soup still reads as 5 planar faces.
  const mesh = carvedMesh(getSolidMeshesFromObject3D(host)[0]);
  assert.equal(mesh.faces.length, 5);
});
