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
