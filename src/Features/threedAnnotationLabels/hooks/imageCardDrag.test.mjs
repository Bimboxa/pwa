import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  Scene,
  Sprite,
  SpriteMaterial,
  Vector3,
} from "three";

// Exercise the production pointer handlers and Three raycasting. Only React,
// application state and persistence are replaced with a deterministic fixture.
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.."
);
const mocks = {
  react:
    "export const useRef = current => ({current}); export const useEffect = fn => { globalThis.__drag.cleanup = fn(); };",
  "react-redux":
    "export const useDispatch = () => a => globalThis.__drag.actions.push(a); export const useSelector = fn => fn(globalThis.__drag.state);",
  "App/db/db":
    "export default {annotations:{get:async()=>globalThis.__drag.row, update:async(id,changes)=>{globalThis.__drag.writes.push(changes);Object.assign(globalThis.__drag.row,changes);}}};",
  "Features/mapEditor/hooks/useAnnotationPermissions":
    "export default ()=>({canEditAnnotation:()=>globalThis.__drag.editable});",
  "Features/threedEditor/services/threedEditorRegistry":
    "export const getActiveThreedEditor=()=>globalThis.__drag.editor;",
  "Features/threedMesh/services/mesh3dLabelGestureStore":
    "export const setMesh3dLabelGestureActive = value => {globalThis.__drag.active=value;};",
  "Features/selection/selectionSlice":
    "export const selectSelectedItems=s=>s.items; export const setSelectedItem=payload=>({type:'selection',payload});",
};
for (const [module, names] of Object.entries({
  "Features/annotations/annotationsSlice": ["triggerAnnotationsUpdate"],
  "Features/layout/layoutSlice": ["setToaster"],
  "Features/mapEditor/mapEditorSlice": [
    "setSelectedNode",
    "setAnnotationToolbarPosition",
    "setAnnotationsToolbarPosition",
  ],
  "Features/threedEditor/threedEditorSlice": ["clearSubSelection"],
}))
  mocks[module] = names
    .map((name) => `export const ${name}=payload=>({type:'${name}',payload});`)
    .join("\n");
const bundle = await build({
  stdin: {
    contents: `export {default as useDrag} from "Features/threedAnnotationLabels/hooks/useAnnotationLabelDragHandlers";
export {setAnnotationLabelObjects} from "Features/threedAnnotationLabels/services/annotationLabelObjectsStore";`,
    resolveDir: root,
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  plugins: [
    {
      name: "fixtures",
      setup(b) {
        b.onResolve({ filter: /.*/ }, (args) => {
          if (mocks[args.path]) return { path: args.path, namespace: "mock" };
          if (args.path.startsWith("Features/"))
            return { path: path.join(root, "src", args.path + ".js") };
        });
        b.onLoad({ filter: /.*/, namespace: "mock" }, (args) => ({
          contents: mocks[args.path],
        }));
      },
    },
  ],
});
const { useDrag, setAnnotationLabelObjects } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text + "\n//# sourceURL=imageCardDrag.bundle.js").toString("base64")}`
);

class Events {
  listeners = new Map();
  style = {};
  clientWidth = 800;
  clientHeight = 600;
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 800, height: 600 };
  }
  addEventListener(name, fn) {
    this.listeners.set(name, fn);
  }
  removeEventListener(name, fn) {
    if (this.listeners.get(name) === fn) this.listeners.delete(name);
  }
  async send(name, props = {}) {
    await this.listeners.get(name)?.({
      button: 0,
      pointerId: 1,
      preventDefault() {},
      ...props,
    });
  }
}

function fixture(
  t,
  { selected = true, editable = true, hidden = false, connector = true } = {}
) {
  const dom = new Events();
  const scene = new Scene();
  const group = new Group();
  scene.add(group);
  group.visible = !hidden;
  const camera = new OrthographicCamera(-4, 4, 3, -3, 0.1, 100);
  camera.position.set(4, 5, 8);
  camera.lookAt(0, 0, 1);
  camera.updateMatrixWorld(true);
  const sprite = new Sprite(new SpriteMaterial());
  sprite.position.set(0, 0, 1);
  sprite.userData = {
    annotationId: "photo",
    annotationType: "IMAGE",
    isImageAnnotationCard: true,
    labelLocal: { x: 0, y: 0, z: 1 },
    targetLocal: { x: 0, y: 0, z: 0 },
    imageSize: { width: 1000, height: 500 },
    meterByPx: 0.01,
    liftM: 1,
    hasConnector: connector,
  };
  group.add(sprite);
  scene.updateMatrixWorld(true);
  const controls = { enabled: true };
  const f = (globalThis.__drag = {
    editable,
    actions: [],
    writes: [],
    active: false,
    row: {
      id: "photo",
      bbox: { x: 0.2, y: 0.3, width: 0.2, height: 0.2 },
      targetPoint: { x: 0.15, y: 0.2 },
    },
    editor: {
      sceneManager: {
        scene,
        camera,
        renderer: { domElement: dom },
        controlsManager: { orbitControls: controls },
        renderScene() {},
      },
    },
    state: {
      items: selected
        ? [{ type: "NODE", nodeType: "ANNOTATION", nodeId: "photo" }]
        : [],
      threedEditor: {
        meshingMode: { active: false },
        drawingMode: { active: false },
        axesSettings: { yawDeg: 0 },
      },
    },
  });
  globalThis.window = new Events();
  setAnnotationLabelObjects({ sprites: [sprite] });
  useDrag({ rendererIsReady: true, annotations: [f.row] });
  t.after(() => {
    f.cleanup();
    sprite.material.dispose();
    setAnnotationLabelObjects({});
    delete globalThis.window;
  });
  const projected = new Vector3(0, 0, 1).project(camera);
  const start = {
    clientX: (projected.x + 1) * 400,
    clientY: (1 - projected.y) * 300,
  };
  return {
    ...f,
    dom,
    sprite,
    controls,
    start,
    async down() {
      await dom.send("pointerdown", start);
    },
    async move(shiftKey = false) {
      await window.send("pointermove", {
        clientX: start.clientX + 85,
        clientY: start.clientY - 46,
        shiftKey,
      });
    },
    async up() {
      await window.send("pointerup", start);
    },
  };
}

test("selected photo moves freely, saves XY/height and leaves its target fixed", async (t) => {
  const f = fixture(t);
  await f.down();
  assert.equal(f.controls.enabled, false);
  await f.move();
  const moved = f.sprite.position.clone();
  assert.ok(moved.distanceTo(new Vector3(0, 0, 1)) > 0.1);
  await f.up();
  assert.equal(f.writes.length, 1);
  assert.deepEqual(f.writes[0].targetPoint, { x: 0.15, y: 0.2 });
  assert.notEqual(f.writes[0].imageLift3d, 1);
  assert.equal(f.controls.enabled, true);
  assert.equal(
    f.actions.find((a) => a.type === "selection").payload.annotationType,
    "IMAGE"
  );
  assert.equal(
    f.actions.find((a) => a.type === "selection").payload.type,
    "NODE"
  );
});
test("Shift locks photo displacement to one world axis", async (t) => {
  const f = fixture(t);
  await f.down();
  await f.move(true);
  const delta = f.sprite.position.clone().sub(new Vector3(0, 0, 1));
  assert.equal(delta.toArray().filter((v) => Math.abs(v) > 1e-6).length, 1);
  await f.up();
  assert.equal(f.writes.length, 1);
});
test("Escape restores geometry, releases the camera and never saves", async (t) => {
  const f = fixture(t);
  await f.down();
  await f.move();
  await window.send("keydown", { key: "Escape" });
  assert.deepEqual(f.sprite.position.toArray(), [0, 0, 1]);
  assert.equal(f.writes.length, 0);
  assert.equal(f.controls.enabled, true);
  assert.equal(globalThis.__drag.active, false);
});
test("photos without connectors never gain a leader while dragging", async (t) => {
  const f = fixture(t, { connector: false });
  await f.down();
  await f.move();
  assert.equal(f.sprite.parent.children.length, 1);
  await f.up();
});
for (const options of [{ selected: false }, { editable: false }]) {
  test(`photo with ${JSON.stringify(options)} cannot move`, async (t) => {
    const f = fixture(t, options);
    await f.down();
    await f.move();
    await f.up();
    assert.deepEqual(f.sprite.position.toArray(), [0, 0, 1]);
    assert.equal(f.writes.length, 0);
  });
}
test("hidden photo cards do not intercept the pointer", async (t) => {
  const f = fixture(t, { hidden: true });
  await f.down();
  assert.equal(globalThis.__drag.active, false);
  assert.equal(f.controls.enabled, true);
});

// Target handle of an annotation with a solid (2 m cube, top at z = 2): the
// drag is constrained to the faces of that annotation.
function targetFixture(t) {
  const dom = new Events();
  const scene = new Scene();
  const group = new Group();
  scene.add(group);
  const camera = new OrthographicCamera(-4, 4, 3, -3, 0.1, 100);
  camera.position.set(4, 5, 8);
  camera.lookAt(0, 0, 1);
  camera.updateMatrixWorld(true);

  const solidRoot = new Group();
  solidRoot.userData = { nodeType: "ANNOTATION", nodeId: "wall" };
  const solid = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial());
  solid.position.set(0, 0, 1);
  solidRoot.add(solid);
  scene.add(solidRoot);

  const sprite = new Sprite(new SpriteMaterial());
  sprite.position.set(0, 0, 3);
  sprite.userData = {
    annotationId: "wall",
    annotationType: "POLYGON",
    labelLocal: { x: 0, y: 0, z: 3 },
    targetLocal: { x: 0, y: 0, z: 2 },
    meterByPx: 0.01,
    liftM: 1,
    hasConnector: true,
  };
  const handle = new Sprite(new SpriteMaterial());
  handle.scale.setScalar(0.2);
  handle.position.set(0, 0, 2);
  handle.userData = { annotationId: "wall", labelSprite: sprite };
  group.add(sprite, handle);
  scene.updateMatrixWorld(true);

  const f = (globalThis.__drag = {
    editable: true,
    actions: [],
    writes: [],
    active: false,
    row: { id: "wall", type: "POLYGON" },
    editor: {
      sceneManager: {
        scene,
        camera,
        renderer: { domElement: dom },
        controlsManager: { orbitControls: { enabled: true } },
        annotationsManager: { annotationsObjectsMap: { wall: solidRoot } },
        renderScene() {},
      },
    },
    state: {
      items: [{ type: "NODE", nodeType: "ANNOTATION", nodeId: "wall" }],
      threedEditor: {
        meshingMode: { active: false },
        drawingMode: { active: false },
        axesSettings: { yawDeg: 0 },
      },
    },
  });
  globalThis.window = new Events();
  setAnnotationLabelObjects({ sprites: [sprite], targetHandles: [handle] });
  useDrag({ rendererIsReady: true, annotations: [f.row] });
  t.after(() => {
    f.cleanup();
    setAnnotationLabelObjects({});
    delete globalThis.window;
  });
  const client = (x, y, z) => {
    const p = new Vector3(x, y, z).project(camera);
    return { clientX: (p.x + 1) * 400, clientY: (1 - p.y) * 300 };
  };
  return { ...f, dom, handle, client };
}

test("target of a solid annotation stays on its faces", async (t) => {
  const f = targetFixture(t);
  await f.dom.send("pointerdown", f.client(0, 0, 2));
  assert.equal(globalThis.__drag.active, true);

  // Over the +x side face, half a meter above the plane.
  await window.send("pointermove", f.client(1, 0, 0.5));
  const onFace = f.handle.position.clone();
  assert.ok(onFace.distanceTo(new Vector3(1.01, 0, 0.5)) < 1e-3);

  // Off the annotation: the target keeps its last valid position.
  await window.send("pointermove", { clientX: 5, clientY: 5 });
  assert.ok(f.handle.position.distanceTo(onFace) < 1e-9);

  await window.send("pointerup", f.client(1, 0, 0.5));
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].labelTargetZ3d, 0.5);
  assert.deepEqual(f.writes[0].labelDelta.target, { x: 101, y: 0 });
});
