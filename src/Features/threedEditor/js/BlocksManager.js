import { Box3, Group, Matrix4, Scene } from "three";

import getBaseMapTransform from "Features/baseMaps/js/getBaseMapTransform";

import AnnotationsManager from "./AnnotationsManager";
import createBaseMapFrameGroup from "./utilsAnnotationsManager/createBaseMapFrameGroup";
import getBaseMapForRender from "./utilsAnnotationsManager/getBaseMapForRender";
import pixelToWorld from "./utilsAnnotationsManager/pixelToWorld";

// ---------------------------------------------------------------------------
// BlocksManager — 3D rendering of the blocks (Features/blocks).
//
// A block is built ONCE: its member annotations go through a second
// AnnotationsManager (same builders, diff, async loads, CSG carve, finishing
// passes as the scene's) into an OFF-SCENE prototype scene, each member in
// the frame of its own blocks base map. The prototypes are never rendered
// nor raycast.
//
// Each block instance of the scene (annotation BLOCK_INSTANCE, a placeholder
// Group built by createAnnotationObject3D and owned by the scene's
// AnnotationsManager) is then filled with CLONES of the prototypes:
// Object3D.clone() shares geometries and materials, so N instances cost one
// geometry build and one set of GPU buffers.
//
// Replication: an edit of a member rebuilds its prototype only (incremental
// diff), then every instance of its block is re-filled. No instance row is
// touched.
//
// Block frame: the frame of the ORIGIN blocks base map, translated to the
// block's insertion point. A member drawn on another blocks base map (an
// elevation) keeps its pose relative to the origin base map.
//
// The clones carry `userData.sharedBlockResources`: AnnotationsManager never
// disposes their geometry / material (this manager owns the prototypes).
// ---------------------------------------------------------------------------

const CONTENT_FLAG = "isBlockContent";

export default class BlocksManager {
  constructor({ sceneManager }) {
    this.sceneManager = sceneManager;

    // off-scene prototypes
    this.prototypeScene = new Scene();
    this.baseMapsMap = {}; // blocks base maps (raw records or BaseMap)
    this.frames = {}; // blocks baseMapId -> frame Group (prototype scene)
    this.definitionsByBlockId = {}; // blockId -> {originBaseMapId, originPx, originZ, memberIds}
    this.blockIdsByMemberId = {};
    this._signature = "";
    this._loading = false;

    // The prototype manager believes this facade is its scene manager: it
    // builds into `prototypeScene`, in the frames of the blocks base maps.
    this.prototypeManager = new AnnotationsManager({
      sceneManager: {
        scene: this.prototypeScene,
        get renderer() {
          return sceneManager.renderer;
        },
        requestRender: () => sceneManager.requestRender?.(),
        renderScene: () => sceneManager.renderScene?.(),
        imagesManager: {
          baseMapsMap: this.baseMapsMap,
          getGroup: (baseMapId) => this.frames[baseMapId] ?? null,
        },
      },
    });

    // async completions of a member (GLB load, CSG carve): re-fill the
    // instances of its blocks.
    this._unsubscribePrototypes =
      this.prototypeManager.subscribeAnnotationReady((ids) => {
        if (this._loading) return;
        const blockIds = new Set();
        ids.forEach((id) =>
          (this.blockIdsByMemberId[id] ?? []).forEach((b) => blockIds.add(b))
        );
        if (blockIds.size > 0) this.refillInstances(blockIds);
      });

    // a block instance placeholder was (re)built in the scene: fill it.
    this._unsubscribeInstances =
      sceneManager.annotationsManager.subscribeAnnotationReady((ids) => {
        const map = sceneManager.annotationsManager.annotationsObjectsMap;
        let filled = false;
        ids.forEach((id) => {
          const root = map[id];
          if (!root?.userData?.instanceOfBlockId) return;
          this._fillInstance(root);
          filled = true;
        });
        if (filled) this._afterSceneChange();
      });
  }

  // definitions: [{ block, allMembers, originPx }] (useBlockDefinitions)
  // baseMaps: the blocks base maps (raw records)
  // options: the build options of the scene's annotations (same epoch).
  load({ definitions, baseMaps }, options) {
    this._loading = true;
    try {
      this._syncFrames(baseMaps ?? []);

      const membersById = new Map();
      const definitionsByBlockId = {};
      const blockIdsByMemberId = {};
      (definitions ?? []).forEach((d) => {
        const originBaseMapId = d.block?.origin?.baseMapId;
        if (!originBaseMapId || !this.frames[originBaseMapId]) return;
        const members = (d.allMembers ?? []).filter(
          (m) => m?.id && this.frames[m.baseMapId]
        );
        members.forEach((m) => {
          membersById.set(m.id, m);
          if (!blockIdsByMemberId[m.id]) blockIdsByMemberId[m.id] = [];
          blockIdsByMemberId[m.id].push(d.block.id);
        });
        definitionsByBlockId[d.block.id] = {
          originBaseMapId,
          originPx: d.originPx,
          originZ: Number(d.block.origin.z) || 0,
          memberIds: members.map((m) => m.id),
        };
      });
      this.definitionsByBlockId = definitionsByBlockId;
      this.blockIdsByMemberId = blockIdsByMemberId;

      const members = [...membersById.values()];
      const { toCreate, toRemove } = this.prototypeManager.diffAnnotations(
        members,
        options
      );
      this.prototypeManager.deleteAnnotationsObjects(toRemove);
      this.prototypeManager.createAnnotationsObjects(toCreate, options);

      const signature = this._getSignature();
      const changed =
        toCreate.length > 0 ||
        toRemove.length > 0 ||
        signature !== this._signature;
      this._signature = signature;
      if (changed) this.refillInstances();
    } finally {
      this._loading = false;
    }
  }

  // Re-fill the instances of the given blocks (all blocks when omitted).
  refillInstances(blockIds) {
    const map = this.sceneManager.annotationsManager.annotationsObjectsMap;
    let filled = false;
    Object.values(map).forEach((root) => {
      const blockId = root?.userData?.instanceOfBlockId;
      if (!blockId || (blockIds && !blockIds.has(blockId))) return;
      this._fillInstance(root);
      filled = true;
    });
    if (filled) this._afterSceneChange();
  }

  dispose() {
    this._unsubscribePrototypes?.();
    this._unsubscribeInstances?.();
    this.prototypeManager.deleteAllAnnotationsObjects();
    this.definitionsByBlockId = {};
    this.blockIdsByMemberId = {};
  }

  // --- internals ---

  _syncFrames(baseMaps) {
    const liveIds = new Set(baseMaps.map((b) => b.id));
    Object.keys(this.frames).forEach((id) => {
      if (liveIds.has(id)) return;
      this.prototypeScene.remove(this.frames[id]);
      delete this.frames[id];
      delete this.baseMapsMap[id];
    });
    baseMaps.forEach((baseMap) => {
      this.baseMapsMap[baseMap.id] = baseMap;
      const fresh = createBaseMapFrameGroup(getBaseMapTransform(baseMap));
      const frame = this.frames[baseMap.id];
      if (!frame) {
        this.frames[baseMap.id] = fresh;
        this.prototypeScene.add(fresh);
        return;
      }
      frame.rotation.order = fresh.rotation.order;
      frame.position.copy(fresh.position);
      frame.rotation.copy(fresh.rotation);
    });
    this.prototypeScene.updateMatrixWorld(true);
  }

  // What the instances depend on besides the prototypes themselves: the
  // membership, the insertion point and the relative pose of the frames.
  _getSignature() {
    const parts = Object.entries(this.definitionsByBlockId).map(
      ([blockId, d]) =>
        [
          blockId,
          d.originBaseMapId,
          d.originPx?.x,
          d.originPx?.y,
          d.originZ,
          d.memberIds.join(","),
        ].join(":")
    );
    Object.entries(this.frames).forEach(([id, frame]) => {
      const bm = getBaseMapForRender(this.baseMapsMap[id]);
      parts.push(
        [
          id,
          ...frame.matrixWorld.elements.map((v) => Math.round(v * 1e6) / 1e6),
          bm?.imageWidth,
          bm?.imageHeight,
          bm?.meterByPx,
        ].join(":")
      );
    });
    return parts.join("|");
  }

  // World (prototype scene) → block frame.
  _getBlockInverseMatrix(definition) {
    const frame = this.frames[definition.originBaseMapId];
    const baseMap = getBaseMapForRender(
      this.baseMapsMap[definition.originBaseMapId]
    );
    if (!frame || !baseMap || !definition.originPx) return null;
    const origin = pixelToWorld(definition.originPx, baseMap);
    return frame.matrixWorld
      .clone()
      .multiply(
        new Matrix4().makeTranslation(origin.x, origin.y, definition.originZ)
      )
      .invert();
  }

  _fillInstance(root) {
    // drop the previous content — never disposed: its resources are shared
    [...root.children].forEach((child) => {
      if (child.userData?.[CONTENT_FLAG]) root.remove(child);
    });
    const content = this.createBlockContent(root.userData?.instanceOfBlockId);
    if (content) root.add(content);
  }

  // The clones of a block's prototypes, in the BLOCK FRAME (insertion point
  // at the origin, Z = normal of the origin base map): what an instance
  // placeholder holds, and the preview of the 3D placement. null when the
  // block is unknown. Shared geometries / materials: never dispose it.
  createBlockContent(blockId) {
    const definition = this.definitionsByBlockId[blockId];
    if (!definition) return null;
    this.prototypeScene.updateMatrixWorld(true);
    const inverse = this._getBlockInverseMatrix(definition);
    if (!inverse) return null;

    const content = new Group();
    content.userData[CONTENT_FLAG] = true;
    const prototypes = this.prototypeManager.annotationsObjectsMap;
    definition.memberIds.forEach((memberId) => {
      const prototype = prototypes[memberId];
      if (!prototype) return;
      let clone;
      try {
        // geometries and materials are shared with the prototype
        clone = prototype.clone(true);
      } catch (e) {
        console.error("[BlocksManager] member clone failed", memberId, e);
        return;
      }
      inverse
        .clone()
        .multiply(prototype.matrixWorld)
        .decompose(clone.position, clone.quaternion, clone.scale);
      clone.traverse((child) => {
        const userData = { ...(child.userData ?? {}) };
        // picking / hover walk up to the INSTANCE root, never to a member
        delete userData.nodeId;
        delete userData.nodeType;
        delete userData.vertexRefs;
        userData.sharedBlockResources = true;
        child.userData = userData;
      });
      content.add(clone);
    });
    return content;
  }

  // Radius (meters) of the block around its insertion point, in the plane of
  // its origin base map — the footprint circle of the 3D placement.
  getBlockFootprintRadius(blockId) {
    const content = this.createBlockContent(blockId);
    if (!content) return null;
    content.updateMatrixWorld(true);
    const box = new Box3().setFromObject(content);
    if (box.isEmpty()) return null;
    return Math.max(
      Math.hypot(box.min.x, box.min.y),
      Math.hypot(box.max.x, box.max.y),
      Math.hypot(box.min.x, box.max.y),
      Math.hypot(box.max.x, box.min.y)
    );
  }

  _afterSceneChange() {
    this.sceneManager.clippingManager?.reapply?.();
    this.sceneManager.renderModeManager?.onSceneStructureChanged?.();
    this.sceneManager.requestRender?.();
  }
}
