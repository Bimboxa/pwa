import { Box3, Euler, Matrix4, Quaternion, Vector2, Vector3 } from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

import { BASE_MAP_ROTATION_ORDER } from "Features/baseMaps/js/getBaseMapTransform";
import { easeInOutCubic } from "Features/pov/utils/getPovFlightPose";

import computeBaseMapsGrid3dPoses, {
  getSheetLocalCorners,
} from "../utils/computeBaseMapsGrid3dPoses";
import createSheetDecorations from "./createSheetDecorations";

const FLIGHT_DURATION_MS = 600;
const OUTLINE_IDLE_COLOR = 0xbdbdbd;
const OUTLINE_HOVER_COLOR = 0xe85426; // theme secondary.main
const OUTLINE_IDLE_WIDTH = 1; // px (screen-space)
const OUTLINE_HOVER_WIDTH = 2;

const _quaternion = new Quaternion();
const _euler = new Euler();
const _unitScale = new Vector3(1, 1, 1);

function readPose(group) {
  return {
    position: group.position.clone(),
    euler: { x: group.rotation.x, y: group.rotation.y, z: group.rotation.z },
    scale: group.scale.x,
  };
}

function applyPose(group, pose) {
  group.position.copy(pose.position);
  // Rotation order BEFORE values (same discipline as createImageObject).
  group.rotation.order = BASE_MAP_ROTATION_ORDER;
  group.rotation.set(pose.euler.x, pose.euler.y, pose.euler.z);
  group.scale.setScalar(pose.scale);
}

// three.js side of the 3D base maps grid ("table à plans"): the base map
// groups of a listing fly from their real pose to a flat paper-sheet
// arrangement and back.
//
// A base map group carries its image plane AND its annotation objects as
// children, so posing the group (position / rotation / uniform scale) moves
// everything at once — nothing is recomputed per object.
//
// Per sheet the manager keeps:
//   - homePose: the real pose (db placement). Refreshed by setHomePose when a
//     placement arrives while the grid is open (ThreedEditor
//     .applyBaseMapPlacement no longer writes the group then).
//   - gridPose: the pose on the table.
// A sheet stays registered (isSheet) until the closing flight has landed.
export default class BaseMapsGridManager {
  constructor({ sceneManager }) {
    this.sceneManager = sceneManager;

    // id → { sheet, group, homePose, gridPose, decorations, imageOn }
    this.sheetsById = new Map();
    this.active = false;
    this.anchorId = null;
    // metres per paper point, fixed for the whole session (see open)
    this.K = null;
    this.yaw = 0;
    this.hoveredId = null;
    // closing flight in progress (the sheets are still registered)
    this.closing = false;
    // global "Masquer les fonds de plan" switch (threedEditor.hideBaseMaps)
    this.hideBaseMaps = false;

    this._materials = null;
    this._rafId = null;
    this._listeners = new Set();
  }

  // state

  isActive() {
    return this.active;
  }

  isSheet(baseMapId) {
    return this.sheetsById.has(baseMapId);
  }

  // Called when the groups were dropped under the grid (scene reload): the
  // orchestration hook re-opens it if it is still wanted.
  subscribeInvalidated(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  // open / anchor / close

  // sheets: see buildBaseMapsGrid3dSheets. The groups of the hidden base
  // maps are created texture-less (ImagesManager.ensureBaseMapGroup).
  // Re-entrant: called again while open (sheet set / positions changed) or
  // while closing, the sheets fly on from where they are.
  // Returns { box, yaw } (extent of the table, for the camera) or null.
  open({
    sheets,
    anchorBaseMapId,
    imageOnById = {},
    hideBaseMaps = false,
    animate = true,
  }) {
    const imagesManager = this.sceneManager.imagesManager;
    this._cancelFlight();
    this.closing = false;

    const previous = this.sheetsById;
    const wasOpen = this.active;
    this.sheetsById = new Map();

    (sheets ?? []).forEach((sheet) => {
      const group = imagesManager.ensureBaseMapGroup(sheet.baseMap);
      if (!group) return;
      const previousEntry = previous.get(sheet.id);
      const sameGroup = previousEntry?.group === group;
      previousEntry?.decorations?.dispose();
      this.sheetsById.set(sheet.id, {
        sheet,
        group,
        homePose: sameGroup ? previousEntry.homePose : readPose(group),
        // kept for the re-entry: the anchor stays where the table put it
        gridPose: sameGroup ? previousEntry.gridPose : null,
        scaleOverride: sameGroup ? previousEntry.scaleOverride : null,
        decorations: null,
        imageOn: Boolean(imageOnById[sheet.id]),
      });
    });

    // sheets that left the table
    previous.forEach((entry, id) => {
      if (!this.sheetsById.has(id)) this._releaseEntry(id, entry);
    });

    if (this.sheetsById.size === 0) {
      this.active = false;
      this.sceneManager.renderScene();
      return null;
    }

    this.active = true;
    this.hideBaseMaps = hideBaseMaps;
    this.anchorId = this.sheetsById.has(anchorBaseMapId)
      ? anchorBaseMapId
      : this.sheetsById.keys().next().value;

    // First opening: the anchor keeps its real place, yaw and size — K comes
    // from it. Re-entry: the table keeps its frame, the anchor its grid pose.
    const anchorEntry = this.sheetsById.get(this.anchorId);
    const keepFrame =
      wasOpen && Number.isFinite(this.K) && Boolean(anchorEntry.gridPose);
    const anchorRef = keepFrame
      ? { position: anchorEntry.gridPose.position.clone(), yaw: this.yaw }
      : {
          position: anchorEntry.homePose.position.clone(),
          yaw: anchorEntry.homePose.euler.y,
        };
    const result = this._computePoses({
      anchorRef,
      K: keepFrame ? this.K : undefined,
    });
    if (!result) return null;

    const materials = this._getMaterials();
    this.sheetsById.forEach((entry) => {
      entry.decorations = createSheetDecorations({
        sheet: entry.sheet,
        meterByPx: entry.gridPose.effectiveMeterByPx,
        materials,
        imageOn: entry.imageOn,
      });
      entry.decorations.objects.forEach((object) => entry.group.add(object));
      entry.group.visible = true;
      this._applyImageVisibility(entry);
      this._applySheetScale(entry);
    });
    this.hoveredId = null;

    this._fly({ toGrid: true, instant: !animate });
    return { box: result.box, yaw: this.yaw };
  }

  // Leaves the grid AROUND one sheet: that sheet stays exactly where it is
  // on screen while the others fly back to their real poses around it.
  // The whole table and the camera are first moved, at once, by the
  // similarity that takes the sheet from where it lies to its real pose —
  // nothing changes on screen — then the regular closing flight runs (the
  // kept sheet is already home).
  closeAround(baseMapId) {
    const kept = this.sheetsById.get(baseMapId);
    if (!kept || !kept.group.parent || this.closing) {
      this.close();
      return;
    }
    this._cancelFlight();

    const { position, euler } = kept.homePose;
    _quaternion.setFromEuler(
      _euler.set(euler.x, euler.y, euler.z, BASE_MAP_ROTATION_ORDER)
    );
    const home = new Matrix4().compose(position, _quaternion, _unitScale);
    kept.group.updateMatrix();
    // uniform scale of the similarity (the sheet goes back to scale 1)
    const ratio = 1 / (kept.group.scale.x || 1);
    const transform = home.multiply(kept.group.matrix.clone().invert());

    this.sheetsById.forEach((entry) => {
      const group = entry.group;
      if (!group.parent) return;
      group.updateMatrix();
      group.matrix
        .clone()
        .premultiply(transform)
        .decompose(group.position, group.quaternion, group.scale);
    });
    // exact landing of the kept sheet (no decomposition drift)
    applyPose(kept.group, { ...kept.homePose, scale: 1 });

    this._moveCamera(transform, ratio);
    this.close();
  }

  // Back to the real poses. The decorations and the texture-less groups are
  // dropped once the flight has landed.
  close({ instant = false } = {}) {
    if (this.sheetsById.size === 0) {
      this.active = false;
      return;
    }
    // already flying home (closeAround, then the redux close)
    if (this.closing && !instant) return;
    this.closing = true;
    this.active = false;
    this.hoveredId = null;
    this.sheetsById.forEach((entry) => entry.decorations?.setHovered(false));
    this._fly({
      toGrid: false,
      instant,
      onDone: () => this._releaseAll(),
    });
  }

  // decorations state

  setHovered(baseMapId) {
    const nextId = this.sheetsById.has(baseMapId) ? baseMapId : null;
    if (nextId === this.hoveredId) return;
    this.sheetsById.get(this.hoveredId)?.decorations?.setHovered(false);
    this.sheetsById.get(nextId)?.decorations?.setHovered(true);
    this.hoveredId = nextId;
    this.sceneManager.renderScene();
  }

  // { [baseMapId]: bool } — image eye of each base map (same state as the
  // layer icon of the chips). Drives the eye button, the label (shown while
  // the image is off) and the image itself: on the table every group stays
  // displayed, so the image of a base map that no longer takes part in the
  // scene is hidden here (the regular visibility pass would hide its group).
  setImageOnById(imageOnById, { hideBaseMaps = false } = {}) {
    this.hideBaseMaps = hideBaseMaps;
    this.sheetsById.forEach((entry, id) => {
      const imageOn = Boolean(imageOnById?.[id]);
      if (entry.imageOn !== imageOn) {
        entry.imageOn = imageOn;
        entry.decorations?.setImageOn(imageOn);
      }
      this._applyImageVisibility(entry);
    });
    this.sceneManager.renderScene();
  }

  // pose hooks (ThreedEditor / ImagesManager)

  // A db placement arrived while the sheet is on the table: it becomes the
  // pose the sheet flies back to (the closing flight follows it live).
  setHomePose(baseMapId, { position, euler }) {
    const entry = this.sheetsById.get(baseMapId);
    if (!entry) return;
    entry.homePose.position.set(position.x, position.y, position.z);
    entry.homePose.euler = { x: euler.x, y: euler.y, z: euler.z };
  }

  // A group (re)created for a registered sheet joins its sheet pose.
  onGroupCreated(baseMapId, group) {
    const entry = this.sheetsById.get(baseMapId);
    if (!entry || entry.group === group) return;
    entry.decorations?.objects.forEach((object) => group.add(object));
    entry.group = group;
    entry.homePose = readPose(group);
    group.visible = true;
    if (this.active && entry.gridPose) applyPose(group, entry.gridPose);
  }

  // Every base map group is being dropped (scene reload).
  onGroupsDeleted() {
    if (this.sheetsById.size === 0) return;
    this._cancelFlight();
    this.sheetsById.forEach((entry) => entry.decorations?.dispose());
    this.sheetsById = new Map();
    const wasActive = this.active;
    this.active = false;
    this.closing = false;
    this.hoveredId = null;
    if (wasActive) this._listeners.forEach((listener) => listener());
  }

  // picking

  // What lies under the pointer: { kind: "eye" | "nav" | "sheet", baseMapId }
  // or null. The raycaster must be set from the camera (sprites need it). No
  // visibility filter on purpose: the hit planes are not rendered.
  pick(raycaster) {
    if (!this.active) return null;
    const buttons = [];
    const planes = [];
    this.sheetsById.forEach((entry) => {
      if (!entry.decorations) return;
      buttons.push(entry.decorations.eyeSprite, entry.decorations.navSprite);
      planes.push(entry.decorations.hitPlane);
    });
    const buttonHit = raycaster.intersectObjects(buttons, false)[0];
    if (buttonHit) {
      const { baseMapId, gridNavButton } = buttonHit.object.userData;
      return { kind: gridNavButton ? "nav" : "eye", baseMapId };
    }
    const planeHit = raycaster.intersectObjects(planes, false)[0];
    if (planeHit) {
      return { kind: "sheet", baseMapId: planeHit.object.userData.baseMapId };
    }
    return null;
  }

  getSheetName(baseMapId) {
    return this.sheetsById.get(baseMapId)?.sheet?.name ?? null;
  }

  // Real-world frame of a sheet (its print zone at the home pose): what the
  // camera frames when the base map is opened from the grid.
  // Returns { box, normal } or null.
  getHomeFrame(baseMapId) {
    const entry = this.sheetsById.get(baseMapId);
    if (!entry?.gridPose) return null;
    const { position, euler } = entry.homePose;
    _quaternion.setFromEuler(
      _euler.set(euler.x, euler.y, euler.z, BASE_MAP_ROTATION_ORDER)
    );
    const box = new Box3();
    getSheetLocalCorners(
      entry.sheet,
      entry.gridPose.effectiveMeterByPx
    ).forEach((corner) =>
      box.expandByPoint(corner.applyQuaternion(_quaternion).add(position))
    );
    const normal = new Vector3(0, 0, 1).applyQuaternion(_quaternion);
    return { box, normal };
  }

  // lifecycle

  // Keeps the screen-space outlines crisp after a canvas resize.
  onResize() {
    if (!this._materials) return;
    const resolution = this._resolution();
    this._materials.idle.resolution.copy(resolution);
    this._materials.hover.resolution.copy(resolution);
  }

  dispose() {
    this._cancelFlight();
    this.sheetsById.forEach((entry) => entry.decorations?.dispose());
    this.sheetsById = new Map();
    this.active = false;
    this.closing = false;
    this._materials?.idle.dispose();
    this._materials?.hover.dispose();
    this._materials = null;
    this._listeners.clear();
  }

  // internals

  // Moves the camera by a similarity (rigid transform + uniform scale), at
  // once: what is on screen does not change when the scene moved the same.
  _moveCamera(transform, ratio) {
    const controlsManager = this.sceneManager.controlsManager;
    const controls = controlsManager?.cameraControls;
    if (!controls) return;
    const position = controls.getPosition(new Vector3(), false);
    const target = controls.getTarget(new Vector3(), false);
    const focalOffset = controls.getFocalOffset(new Vector3(), false);
    position.applyMatrix4(transform);
    target.applyMatrix4(transform);
    focalOffset.multiplyScalar(ratio);
    controls.setLookAt(
      position.x,
      position.y,
      position.z,
      target.x,
      target.y,
      target.z,
      false
    );
    controls.setFocalOffset(focalOffset.x, focalOffset.y, focalOffset.z, false);
    controlsManager.syncCameraNow?.();
  }

  _applyImageVisibility(entry) {
    const meshWrap = entry.group.userData.meshWrap;
    if (meshWrap) meshWrap.visible = entry.imageOn && !this.hideBaseMaps;
  }

  // A base map without a scale has a 0-sized image plane. On the table it
  // gets the scale of its sheet (effectiveMeterByPx) so its image can show;
  // the real (missing) scale comes back when the sheet is released.
  _applySheetScale(entry) {
    const meterByPx = entry.gridPose?.effectiveMeterByPx;
    const current = entry.group.userData.meterByPx;
    const hasScale = Number.isFinite(current) && current > 0;
    if (hasScale && !entry.scaleOverride) return;
    if (!Number.isFinite(meterByPx) || meterByPx <= 0) return;
    entry.scaleOverride = meterByPx;
    this.sceneManager.imagesManager.setBaseMapPlaneScale(
      entry.sheet.id,
      meterByPx
    );
  }

  _resolution() {
    const dom = this.sceneManager.renderer?.domElement;
    if (!dom) return new Vector2(1, 1);
    return new Vector2(dom.clientWidth || 1, dom.clientHeight || 1);
  }

  _getMaterials() {
    if (this._materials) {
      this.onResize();
      return this._materials;
    }
    const common = {
      resolution: this._resolution(),
      worldUnits: false,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    };
    this._materials = {
      idle: new LineMaterial({
        ...common,
        color: OUTLINE_IDLE_COLOR,
        linewidth: OUTLINE_IDLE_WIDTH,
      }),
      hover: new LineMaterial({
        ...common,
        color: OUTLINE_HOVER_COLOR,
        linewidth: OUTLINE_HOVER_WIDTH,
      }),
    };
    return this._materials;
  }

  // Grid poses of every sheet for the current anchor. Writes
  // entry.gridPose and the session frame (K, yaw).
  _computePoses({ anchorRef, K }) {
    const sheets = [...this.sheetsById.values()].map((entry) => entry.sheet);

    const result = computeBaseMapsGrid3dPoses({
      sheets,
      anchorId: this.anchorId,
      anchorRef,
      K,
    });
    if (!result) return null;

    this.K = result.K;
    this.yaw = result.yaw;
    const box = new Box3();
    this.sheetsById.forEach((entry, id) => {
      entry.gridPose = result.poseById[id];
      result.cornersById[id].forEach((corner) => box.expandByPoint(corner));
    });
    return { box };
  }

  // One rAF loop for every group: position + scale lerp, quaternion slerp.
  // The targets are read each frame (a home pose can change mid-flight), and
  // the exact Euler is written at landing so `rotation.y` stays meaningful.
  _fly({ toGrid, instant = false, onDone } = {}) {
    this._cancelFlight();

    const flights = [];
    this.sheetsById.forEach((entry) => {
      // group dropped from the scene meanwhile
      if (!entry.group.parent) return;
      if (toGrid && !entry.gridPose) return;
      flights.push({
        group: entry.group,
        entry,
        toGrid,
        fromPosition: entry.group.position.clone(),
        fromQuaternion: entry.group.quaternion.clone(),
        fromScale: entry.group.scale.x,
      });
    });

    const getTarget = (flight) =>
      flight.toGrid
        ? flight.entry.gridPose
        : { ...flight.entry.homePose, scale: 1 };

    const land = () => {
      flights.forEach((flight) => applyPose(flight.group, getTarget(flight)));
      this.sceneManager.renderScene();
      onDone?.();
    };

    if (instant || flights.length === 0) {
      land();
      return;
    }

    const startTime = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - startTime) / FLIGHT_DURATION_MS);
      if (t >= 1) {
        this._rafId = null;
        land();
        return;
      }
      const e = easeInOutCubic(t);
      flights.forEach((flight) => {
        const target = getTarget(flight);
        flight.group.position.lerpVectors(
          flight.fromPosition,
          target.position,
          e
        );
        _quaternion.setFromEuler(
          _euler.set(
            target.euler.x,
            target.euler.y,
            target.euler.z,
            BASE_MAP_ROTATION_ORDER
          )
        );
        flight.group.quaternion.slerpQuaternions(
          flight.fromQuaternion,
          _quaternion,
          e
        );
        flight.group.scale.setScalar(
          flight.fromScale + (target.scale - flight.fromScale) * e
        );
      });
      this.sceneManager.renderScene();
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  // Stops the running flight where it is (the next one starts from there).
  _cancelFlight() {
    if (this._rafId !== null) cancelAnimationFrame(this._rafId);
    this._rafId = null;
  }

  // A sheet leaves the table: real pose, recorded visibility, no decoration;
  // its group is dropped when it never got an image nor annotations.
  _releaseEntry(id, entry) {
    const imagesManager = this.sceneManager.imagesManager;
    entry.decorations?.dispose();
    entry.decorations = null;
    if (!entry.group.parent) return;
    applyPose(entry.group, { ...entry.homePose, scale: 1 });
    entry.group.visible = imagesManager.groupVisibleByBaseMapId[id] ?? true;
    const meshWrap = entry.group.userData.meshWrap;
    if (meshWrap) {
      meshWrap.visible = imagesManager.imageVisibleByBaseMapId[id] ?? true;
    }
    // scale lent by the table, unless a real one arrived meanwhile
    if (
      entry.scaleOverride &&
      entry.group.userData.meterByPx === entry.scaleOverride
    ) {
      imagesManager.setBaseMapPlaneScale(id, entry.sheet.meterByPx);
    }
    imagesManager.removeUntexturedGroup(id);
  }

  _releaseAll() {
    const entries = this.sheetsById;
    // Emptied first: the groups are no longer sheets for the visibility /
    // placement hooks called below.
    this.sheetsById = new Map();
    entries.forEach((entry, id) => this._releaseEntry(id, entry));
    this.K = null;
    this.anchorId = null;
    this.closing = false;
    this.sceneManager.renderScene();
  }
}
