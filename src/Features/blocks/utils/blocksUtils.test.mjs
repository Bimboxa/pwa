import assert from "node:assert/strict";
import { test } from "node:test";

import groupBlockMembers from "./groupBlockMembers.js";
import getNormalizedPointsCenter from "./getNormalizedPointsCenter.js";
import getNextBlocksBaseMapName from "./getNextBlocksBaseMapName.js";
import {
  isBlockInstanceAnnotation,
  isBlockMemberAnnotation,
} from "./blockTypes.js";

test("members are grouped by block, instances and unlinked rows are skipped", () => {
  const annotations = [
    { id: "a", blockId: "b1" },
    { id: "b", blockId: "b2" },
    { id: "c" },
    { id: "d", blockId: "b1" },
    { id: "e", type: "BLOCK_INSTANCE", instanceOfBlockId: "b1" },
    // an instance never counts as a member, even with a stray blockId
    { id: "f", type: "BLOCK_INSTANCE", blockId: "b1" },
  ];
  const groups = groupBlockMembers(annotations);
  assert.deepEqual(Object.keys(groups).sort(), ["b1", "b2"]);
  assert.deepEqual(
    groups.b1.map((a) => a.id),
    ["a", "d"]
  );
  assert.deepEqual(groupBlockMembers(null), {});
});

test("member / instance predicates", () => {
  assert.equal(isBlockInstanceAnnotation({ type: "BLOCK_INSTANCE" }), true);
  assert.equal(isBlockInstanceAnnotation({ type: "POLYGON" }), false);
  assert.equal(isBlockMemberAnnotation({ type: "POLYGON", blockId: "b" }), true);
  assert.equal(isBlockMemberAnnotation({ type: "POLYGON" }), false);
  assert.equal(
    isBlockMemberAnnotation({ type: "BLOCK_INSTANCE", blockId: "b" }),
    false
  );
});

test("the center is the middle of the bounding box, not the mean", () => {
  const center = getNormalizedPointsCenter([
    { x: 0.1, y: 0.2 },
    { x: 0.1, y: 0.2 },
    { x: 0.5, y: 0.6 },
    { x: NaN, y: 0.9 },
    null,
  ]);
  assert.ok(Math.abs(center.x - 0.3) < 1e-12);
  assert.ok(Math.abs(center.y - 0.4) < 1e-12);
  assert.equal(getNormalizedPointsCenter([]), null);
  assert.equal(getNormalizedPointsCenter([{ x: "a", y: 1 }]), null);
});

test("blocks base map names never collide", () => {
  assert.equal(getNextBlocksBaseMapName([]), "Blocs");
  assert.equal(getNextBlocksBaseMapName(["Blocs"]), "Blocs 2");
  assert.equal(getNextBlocksBaseMapName(["Blocs", "Blocs 2"]), "Blocs 3");
  assert.equal(getNextBlocksBaseMapName(["Blocs 2"]), "Blocs");
});

// ---------------------------------------------------------------------------
// instance geometry
// ---------------------------------------------------------------------------

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test("block bounds are in meters around the insertion point", async () => {
  const { default: getBlockBoundsM } = await import("./getBlockBoundsM.js");
  const members = [
    {
      type: "POLYGON",
      points: [
        { x: 100, y: 200 },
        { x: 300, y: 200 },
        { x: 300, y: 260 },
      ],
    },
    { type: "POLYLINE", points: [{ x: 50, y: 210 }, { x: 60, y: 220 }] },
    { type: "POLYLINE", points: [] }, // nothing measurable
  ];
  const bounds = getBlockBoundsM({
    members,
    originPx: { x: 200, y: 230 },
    meterByPx: 0.01,
  });
  assert.ok(near(bounds.minX, -1.5));
  assert.ok(near(bounds.maxX, 1));
  assert.ok(near(bounds.minY, -0.3));
  assert.ok(near(bounds.maxY, 0.3));
  assert.equal(
    getBlockBoundsM({ members: [], originPx: { x: 0, y: 0 }, meterByPx: 1 }),
    null
  );
  assert.equal(
    getBlockBoundsM({ members, originPx: { x: 0, y: 0 }, meterByPx: 0 }),
    null
  );
});

test("an instance is drawn at real size whatever the host scale", async () => {
  const { blockPointToHostPx, hostPxToBlockPoint, getBlockInstanceAnchorPx } =
    await import("./blockInstanceGeometry.js");
  const anchorPx = getBlockInstanceAnchorPx({
    bbox: { x: 500, y: 400, width: 0, height: 0 },
  });
  assert.deepEqual(anchorPx, { x: 500, y: 400 });

  // 2 m along x: 200 px on a 1 cm/px plan, 40 px on a 5 cm/px plan
  for (const [hostMeterByPx, expected] of [
    [0.01, 200],
    [0.05, 40],
  ]) {
    const p = blockPointToHostPx({
      pointM: { x: 2, y: 0 },
      anchorPx,
      rotationDeg: 0,
      hostMeterByPx,
    });
    assert.ok(near(p.x, 500 + expected));
    assert.ok(near(p.y, 400));
  }

  // rotation sign: +90° turns clockwise ON SCREEN (y down): +x goes to +y
  const turned = blockPointToHostPx({
    pointM: { x: 1, y: 0 },
    anchorPx,
    rotationDeg: 90,
    hostMeterByPx: 0.01,
  });
  assert.ok(near(turned.x, 500));
  assert.ok(near(turned.y, 500));

  // round trip
  const back = hostPxToBlockPoint({
    pointPx: blockPointToHostPx({
      pointM: { x: 1.25, y: -0.4 },
      anchorPx,
      rotationDeg: 37,
      hostMeterByPx: 0.02,
    }),
    anchorPx,
    rotationDeg: 37,
    hostMeterByPx: 0.02,
  });
  assert.ok(near(back.x, 1.25));
  assert.ok(near(back.y, -0.4));
});

test("instance bounds follow the rotation", async () => {
  const { getBlockInstanceBoundsPx } = await import(
    "./blockInstanceGeometry.js"
  );
  const boundsM = { minX: -1, minY: -0.5, maxX: 1, maxY: 0.5 };
  const anchorPx = { x: 1000, y: 1000 };
  const flat = getBlockInstanceBoundsPx({
    boundsM,
    anchorPx,
    rotationDeg: 0,
    hostMeterByPx: 0.01,
  });
  assert.ok(near(flat.x, 900) && near(flat.width, 200));
  assert.ok(near(flat.y, 950) && near(flat.height, 100));
  const turned = getBlockInstanceBoundsPx({
    boundsM,
    anchorPx,
    rotationDeg: 90,
    hostMeterByPx: 0.01,
  });
  assert.ok(near(turned.width, 100) && near(turned.height, 200));
  assert.equal(
    getBlockInstanceBoundsPx({ boundsM: null, anchorPx, hostMeterByPx: 0.01 }),
    null
  );
});

test("« Déplacer » / « Tourner » carry a block instance by its zero-size anchor", async () => {
  const { default: getObject3DTransformUpdates } = await import(
    "../../annotationTransform/utils/getObject3DTransformUpdates.js"
  );
  const imageSize = { width: 1000, height: 500 };
  const instance = {
    id: "i1",
    type: "BLOCK_INSTANCE",
    bbox: { x: 100, y: 100, width: 0, height: 0 },
    rotation: 10,
  };
  const moved = getObject3DTransformUpdates({
    annotations: [instance],
    transform: { kind: "MOVE", deltaPx: { x: 50, y: -20 }, deltaZ: 0.5 },
    imageSize,
  }).get("i1").fields;
  assert.ok(near(moved.bbox.x, 0.15) && near(moved.bbox.y, 0.16));
  assert.equal(moved.bbox.width, 0);
  assert.equal(moved.bbox.height, 0);
  assert.ok(near(moved.offsetZ, 0.5));
  assert.equal(moved.rotation, undefined);

  // quarter turn about a pivot 100 px to the left: the anchor orbits it
  const turned = getObject3DTransformUpdates({
    annotations: [instance],
    transform: { kind: "ROTATE", pivotPx: { x: 0, y: 100 }, angleDeg: 90 },
    imageSize,
  }).get("i1").fields;
  assert.ok(near(turned.bbox.x * 1000, 0, 1e-6));
  assert.ok(near(turned.bbox.y * 500, 200, 1e-6));
  assert.ok(near(turned.rotation, 100));
});

// ---------------------------------------------------------------------------
// « Lier à un bloc » from a regular base map
// ---------------------------------------------------------------------------

// What pasteAnnotationService does to a point (applyPasteTransformToPoints:
// scale about the source center, turn, put the center on the target).
function pastePoint(p, { sourceCenterPx, targetCenterPx, rotationDeg, scale }) {
  const rad = (rotationDeg * Math.PI) / 180;
  const dx = (p.x - sourceCenterPx.x) * scale;
  const dy = (p.y - sourceCenterPx.y) * scale;
  return {
    x: targetCenterPx.x + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: targetCenterPx.y + dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

test("linking into a NEW block leaves the geometry in place on screen", async () => {
  const { default: getBlockLinkPlacement } = await import(
    "./getBlockLinkPlacement.js"
  );
  const { blockPointToHostPx } = await import("./blockInstanceGeometry.js");
  const hostMeterByPx = 0.02;
  const blockMeterByPx = 0.008;
  const sourceCenterPx = { x: 640, y: 380 };
  const placement = getBlockLinkPlacement({
    sourceCenterPx,
    hostMeterByPx,
    blockMeterByPx,
    originPx: null,
    slotCenterPx: { x: 300, y: 250 },
    referenceInstance: null,
  });
  assert.equal(placement.setsOrigin, true);
  assert.deepEqual(placement.originPx, { x: 300, y: 250 });
  assert.deepEqual(placement.instance, {
    anchorPx: sourceCenterPx,
    rotation: 0,
  });

  // a vertex of the selection: host px → blocks px (move) → host px (instance)
  const vertex = { x: 700, y: 350 };
  const moved = pastePoint(vertex, {
    sourceCenterPx,
    targetCenterPx: placement.targetCenterPx,
    rotationDeg: placement.rotationDeg,
    scale: hostMeterByPx / blockMeterByPx,
  });
  const back = blockPointToHostPx({
    pointM: {
      x: (moved.x - placement.originPx.x) * blockMeterByPx,
      y: (moved.y - placement.originPx.y) * blockMeterByPx,
    },
    anchorPx: placement.instance.anchorPx,
    rotationDeg: placement.instance.rotation,
    hostMeterByPx,
  });
  assert.ok(near(back.x, vertex.x, 1e-6) && near(back.y, vertex.y, 1e-6));
});

test("linking into an EXISTING block goes through the reference instance", async () => {
  const { default: getBlockLinkPlacement } = await import(
    "./getBlockLinkPlacement.js"
  );
  const { blockPointToHostPx } = await import("./blockInstanceGeometry.js");
  const hostMeterByPx = 0.02;
  const blockMeterByPx = 0.008;
  const originPx = { x: 900, y: 700 };
  const referenceInstance = {
    anchorPx: { x: 400, y: 300 },
    rotation: 35,
    offsetZ: 1.2,
  };
  const sourceCenterPx = { x: 455, y: 290 };
  const placement = getBlockLinkPlacement({
    sourceCenterPx,
    hostMeterByPx,
    blockMeterByPx,
    originPx,
    slotCenterPx: null,
    referenceInstance,
  });
  assert.equal(placement.setsOrigin, false);
  assert.equal(placement.instance, null);
  assert.equal(placement.rotationDeg, -35);
  assert.ok(near(placement.offsetZDelta, -1.2));

  // the moved vertex, drawn back by the reference instance, has not moved
  for (const vertex of [sourceCenterPx, { x: 500, y: 320 }, { x: 430, y: 250 }]) {
    const moved = pastePoint(vertex, {
      sourceCenterPx,
      targetCenterPx: placement.targetCenterPx,
      rotationDeg: placement.rotationDeg,
      scale: hostMeterByPx / blockMeterByPx,
    });
    const back = blockPointToHostPx({
      pointM: {
        x: (moved.x - originPx.x) * blockMeterByPx,
        y: (moved.y - originPx.y) * blockMeterByPx,
      },
      anchorPx: referenceInstance.anchorPx,
      rotationDeg: referenceInstance.rotation,
      hostMeterByPx,
    });
    assert.ok(near(back.x, vertex.x, 1e-6) && near(back.y, vertex.y, 1e-6));
  }
});

test("an existing block with no instance here maps the selection center onto its origin", async () => {
  const { default: getBlockLinkPlacement } = await import(
    "./getBlockLinkPlacement.js"
  );
  const placement = getBlockLinkPlacement({
    sourceCenterPx: { x: 10, y: 20 },
    hostMeterByPx: 0.02,
    blockMeterByPx: 0.01,
    originPx: { x: 500, y: 600 },
    slotCenterPx: { x: 1, y: 1 },
    referenceInstance: null,
  });
  assert.deepEqual(placement.targetCenterPx, { x: 500, y: 600 });
  assert.equal(placement.setsOrigin, false);
  assert.deepEqual(placement.instance.anchorPx, { x: 10, y: 20 });
  assert.equal(
    getBlockLinkPlacement({
      sourceCenterPx: { x: 0, y: 0 },
      hostMeterByPx: 0,
      blockMeterByPx: 1,
    }),
    null
  );
});

test("a free slot avoids what is already drawn and stays in the page", async () => {
  const { default: findFreeSlotOnBlocksBaseMap } = await import(
    "./findFreeSlotOnBlocksBaseMap.js"
  );
  const pageSize = { width: 1000, height: 1000 };
  const size = { width: 200, height: 100 };
  const margin = 50;

  // empty page: top-left corner, one margin in
  assert.deepEqual(
    findFreeSlotOnBlocksBaseMap({ occupiedBoxes: [], size, pageSize, margin }),
    { x: 150, y: 100 }
  );

  // that spot taken: next free spot on the same row, one margin away
  const occupied = [{ x: 50, y: 50, width: 200, height: 100 }];
  const slot = findFreeSlotOnBlocksBaseMap({
    occupiedBoxes: occupied,
    size,
    pageSize,
    margin,
  });
  assert.deepEqual(slot, { x: 400, y: 100 });

  // page full, or block larger than the page: no slot
  assert.equal(
    findFreeSlotOnBlocksBaseMap({
      occupiedBoxes: [{ x: 0, y: 0, width: 1000, height: 1000 }],
      size,
      pageSize,
      margin,
    }),
    null
  );
  assert.equal(
    findFreeSlotOnBlocksBaseMap({
      occupiedBoxes: [],
      size: { width: 2000, height: 10 },
      pageSize,
      margin,
    }),
    null
  );
});

test("link refusals", async () => {
  const { default: getBlockLinkRefusal, BLOCK_LINK_REFUSALS: R } =
    await import("./getBlockLinkRefusal.js");
  const ok = { type: "POLYGON", baseMapId: "a" };
  assert.equal(getBlockLinkRefusal([ok, { type: "POINT", baseMapId: "a" }]), null);
  assert.equal(getBlockLinkRefusal([]), R.EMPTY);
  assert.equal(
    getBlockLinkRefusal([ok, { type: "POLYGON", baseMapId: "b" }]),
    R.SEVERAL_BASE_MAPS
  );
  assert.equal(
    getBlockLinkRefusal([{ type: "BLOCK_INSTANCE", baseMapId: "a" }]),
    R.UNSUPPORTED_TYPE
  );
  assert.equal(
    getBlockLinkRefusal([{ ...ok, type: "POLYLINE", isOpening: true }]),
    R.OPENING
  );
  assert.equal(getBlockLinkRefusal([{ ...ok, openings: [{}] }]), R.OPENING);
  assert.equal(getBlockLinkRefusal([{ ...ok, isMeshCell: true }]), R.MESH_CELL);
  assert.equal(
    getBlockLinkRefusal([{ ...ok, isBaseMapAnnotation: true }]),
    R.READ_ONLY
  );
});

// ---------------------------------------------------------------------------
// quantities: N instances × the block's quantities
// ---------------------------------------------------------------------------

test("each instance counts as one copy of each member of its block", async () => {
  const { default: expandBlockInstancesForQties } = await import(
    "./expandBlockInstancesForQties.js"
  );
  const instances = [
    { id: "i1", baseMapId: "host", layerId: "L1", bbox: { x: 0.5, y: 0.25, width: 0, height: 0 } },
    { id: "i2", baseMapId: "host2", bbox: { x: 0.1, y: 0.1, width: 0, height: 0 } },
    { id: "i3", baseMapId: "host", bbox: { x: 0.2, y: 0.2, width: 0, height: 0 } },
  ];
  const regular = { id: "r", annotationTemplateId: "t1", baseMapId: "host", qties: { enabled: true, surface: 5 } };
  const memberOnly = {
    id: "m1",
    annotationTemplateId: "t1",
    baseMapId: "blocks",
    baseMapName: "Blocs",
    layerId: "LB",
    qties: { enabled: true, surface: 2, length: 6 },
    _blockQtyOnly: true,
    _blockQtyInstances: instances,
  };
  // a member also shown for itself (the blocks base map is displayed)
  const memberShown = {
    id: "m2",
    annotationTemplateId: "t2",
    baseMapId: "blocks",
    qties: { enabled: true, length: 1 },
    _blockQtyInstances: instances.slice(0, 1),
  };
  const rows = [regular, memberOnly, memberShown];
  const frozen = JSON.stringify(rows);

  const out = expandBlockInstancesForQties(rows, {
    host: { name: "R+1", width: 1000, height: 400 },
    host2: { name: "R+2", width: 500, height: 500 },
  });

  // inputs untouched
  assert.equal(JSON.stringify(rows), frozen);
  // regular row passes through by reference
  assert.equal(out[0], regular);
  // the feed-only member is gone, the shown one stays (without its tags)
  assert.deepEqual(
    out.filter((r) => !r.isBlockInstanceMember).map((r) => r.id),
    ["r", "m2"]
  );
  assert.equal(out.find((r) => r.id === "m2")._blockQtyInstances, undefined);

  const virtual = out.filter((r) => r.isBlockInstanceMember);
  assert.deepEqual(
    virtual.map((r) => r.id).sort(),
    ["i1::m1", "i1::m2", "i2::m1", "i3::m1"]
  );

  // template t1: 5 (regular) + 3 instances × 2 = 11 m²
  const surfaceT1 = out
    .filter((r) => r.annotationTemplateId === "t1")
    .reduce((sum, r) => sum + (r.qties.surface || 0), 0);
  assert.equal(surfaceT1, 11);

  // re-homed on the instance's host
  const v = virtual.find((r) => r.id === "i1::m1");
  assert.equal(v.baseMapId, "host");
  assert.equal(v.baseMapName, "R+1");
  assert.equal(v.layerId, "L1");
  assert.equal(v._blockInstanceId, "i1");
  assert.equal(v._blockMemberId, "m1");
  assert.equal(v._blockInstanceAnchorX, 500);
  assert.equal(v._blockInstanceAnchorY, 100);
  assert.equal(v._blockQtyOnly, undefined);
  assert.equal(virtual.find((r) => r.id === "i2::m1").layerId, null);

  // per base map: host carries 2 copies of m1, host2 one
  assert.equal(virtual.filter((r) => r.baseMapId === "host" && r._blockMemberId === "m1").length, 2);

  // nothing to expand: same array back
  const plain = [regular];
  assert.equal(expandBlockInstancesForQties(plain, {}), plain);
});

test("block totals prefer developed values and skip disabled members", async () => {
  const { default: sumBlockQties } = await import("./sumBlockQties.js");
  const totals = sumBlockQties(
    [
      { enabled: true, surface: 2, length: 6 },
      { enabled: true, surface: 3, surfaceDeveloped: 4, length: 1 },
      { enabled: false, surface: 100, length: 100 },
      { enabled: false },
      null,
    ]
  );
  assert.deepEqual(totals, {
    surface: 6,
    length: 7,
    membersCount: 5,
  });
  assert.deepEqual(sumBlockQties([]), {
    surface: 0,
    length: 0,
    membersCount: 0,
  });
});

test("a virtual quantity row selects its instance", async () => {
  const { default: getSelectableAnnotation, isBlockVirtualRow } = await import(
    "./getSelectableAnnotation.js"
  );
  const regular = { id: "a", type: "POLYGON" };
  assert.equal(getSelectableAnnotation(regular), regular);
  assert.equal(isBlockVirtualRow(regular), false);
  const virtual = {
    id: "i1::m1",
    type: "POLYGON",
    listingId: "l",
    annotationTemplateId: "t",
    baseMapId: "host",
    isBlockInstanceMember: true,
    _blockInstanceId: "i1",
    _blockInstanceAnchorX: 12,
    _blockInstanceAnchorY: 34,
  };
  assert.equal(isBlockVirtualRow(virtual), true);
  assert.deepEqual(getSelectableAnnotation(virtual), {
    id: "i1",
    type: "BLOCK_INSTANCE",
    baseMapId: "host",
    listingId: null,
    annotationTemplateId: undefined,
    x: 12,
    y: 34,
  });
});
