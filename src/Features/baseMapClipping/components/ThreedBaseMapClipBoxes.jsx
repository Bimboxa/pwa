import { useEffect } from "react";

import { useSelector } from "react-redux";

import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Vector3,
} from "three";

import theme from "Styles/theme";

import db from "App/db/db";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { closestPointOnAxis } from "Features/threedDrawing/utils/computeSnapTarget";
import { disposeObject } from "Features/threedDrawing/utils/drawingOverlayLines";
import createRevolutionAxisHandleSprite from "Features/revolutionAxes/utils/createRevolutionAxisHandleSprite";

import getBaseMapClipping3d from "../utils/getBaseMapClipping3d";
import { setBaseMapClipBoxFaces } from "../services/baseMapClipBoxStore";
import { previewBaseMapClipDepth } from "../services/baseMapClipPlanesStore";

const BOX_COLOR = theme.palette.secondary.main;
const FACE_OPACITY = 0.08;

const EMPTY = [];

/**
 * Clip boxes of the base maps in the 3D editor (« Afficher la boîte de
 * coupe » of the base map panel, threedEditor.clipBoxBaseMapIdsIn3d): for
 * each of them, the two faces of its clipping slab — a translucent sheet the
 * size of the base map, in front of it at `frontM` and behind it at `backM`
 * (baseMap.clipping3d) — joined by the four edges of the box.
 *
 * Each face carries four handles, one per corner (same sprite as the
 * horizontal cut of a revolution axis): dragging any of them slides the face
 * along the normal of the base map — see useBaseMapClipBoxDragHandlers. A
 * side without limit (depth null) has no face.
 *
 * The box is a child of the base map group: it follows its moves and its
 * visibility. Display only — never picked, exported or sliced.
 */
export default function ThreedBaseMapClipBoxes({ enabled }) {
  // data

  const clipBoxBaseMapIds = useSelector(
    (s) => s.threedEditor.clipBoxBaseMapIdsIn3d
  );
  const baseMapsUpdatedAt = useSelector((s) => s.baseMaps.baseMapsUpdatedAt);
  // Re-run once the scene has (re)loaded: the base map groups exist then.
  const annotationsLoadTick = useSelector(
    (s) => s.threedEditor.annotationsLoadTick
  );

  // helpers

  const ids = clipBoxBaseMapIds ?? EMPTY;
  const idsKey = ids.join("|");

  // effects

  useEffect(() => {
    if (!enabled || !idsKey) return;
    const sceneManager = getActiveThreedEditor()?.sceneManager;
    const imagesManager = sceneManager?.imagesManager;
    if (!imagesManager) return;

    let cancelled = false;
    const boxes = [];

    (async () => {
      const records = await db.baseMaps.bulkGet(idsKey.split("|"));
      if (cancelled) return;
      const faces = [];

      records.forEach((record) => {
        if (!record?.clipping3d?.enabled) return;
        const group = imagesManager.getGroup(record.id);
        const size = group?.userData?.planePx?.refSizePx;
        const meterByPx = group?.userData?.meterByPx;
        if (!size?.width || !size?.height || !(meterByPx > 0)) return;
        const halfW = (size.width * meterByPx) / 2;
        const halfH = (size.height * meterByPx) / 2;
        const corners = [
          [-halfW, halfH],
          [halfW, halfH],
          [halfW, -halfH],
          [-halfW, -halfH],
        ];
        const { frontM, backM } = getBaseMapClipping3d(record);

        const box = new Group();
        box.userData.isClipBoxGroup = true;

        // the four edges joining the two faces (a missing face: the base
        // map plane itself)
        const edgesGeometry = new BufferGeometry();
        const edges = new LineSegments(
          edgesGeometry,
          new LineBasicMaterial({ color: BOX_COLOR, toneMapped: false })
        );
        edges.userData.isClipBoxHelper = true;
        edges.raycast = () => {};
        box.add(edges);
        const z = { front: 0, back: 0 };
        const refreshEdges = () => {
          const coords = [];
          corners.forEach(([x, y]) => coords.push(x, y, z.front, x, y, z.back));
          edgesGeometry.setAttribute(
            "position",
            new Float32BufferAttribute(coords, 3)
          );
        };

        [
          { side: "front", depth: frontM, sign: 1 },
          { side: "back", depth: backM, sign: -1 },
        ].forEach(({ side, depth, sign }) => {
          if (depth === null) return;
          const faceGroup = new Group();

          const sheet = new Mesh(
            new PlaneGeometry(2 * halfW, 2 * halfH),
            new MeshBasicMaterial({
              color: BOX_COLOR,
              transparent: true,
              opacity: FACE_OPACITY,
              side: DoubleSide,
              depthWrite: false,
              toneMapped: false,
            })
          );
          sheet.userData.isClipBoxHelper = true;
          sheet.userData.isHoverOverlay = true;
          sheet.raycast = () => {};
          faceGroup.add(sheet);

          const outlineGeometry = new BufferGeometry();
          outlineGeometry.setAttribute(
            "position",
            new Float32BufferAttribute(
              corners.flatMap(([x, y]) => [x, y, 0]),
              3
            )
          );
          const outline = new LineLoop(
            outlineGeometry,
            new LineBasicMaterial({ color: BOX_COLOR, toneMapped: false })
          );
          outline.userData.isClipBoxHelper = true;
          outline.raycast = () => {};
          faceGroup.add(outline);

          const handles = corners.map(([x, y]) => {
            const handle = createRevolutionAxisHandleSprite();
            handle.position.set(x, y, 0);
            handle.userData.isClipBoxHandle = true;
            handle.userData.isHoverOverlay = true;
            handle.userData.corner = { x, y };
            faceGroup.add(handle);
            return handle;
          });
          box.add(faceGroup);

          const getNormal = () => {
            group.updateMatrixWorld(true);
            return new Vector3(0, 0, 1).transformDirection(group.matrixWorld);
          };
          const face = {
            baseMapId: record.id,
            side,
            handles,
            depth: 0,
            // Preview: the face, its handles, the edges and the live
            // clipping plane follow `depth`.
            setDepth(next) {
              face.depth = Math.max(0, next);
              z[side] = sign * face.depth;
              faceGroup.position.z = z[side];
              refreshEdges();
              previewBaseMapClipDepth(record.id, side, face.depth);
            },
            depthOfWorldPoint(point) {
              group.updateMatrixWorld(true);
              return sign * group.worldToLocal(point.clone()).z;
            },
            depthOfRay(ray, handle) {
              const normal = getNormal();
              const { x, y } = handle.userData.corner;
              const base = group.localToWorld(new Vector3(x, y, 0));
              const point = closestPointOnAxis(
                ray.origin,
                ray.direction,
                base,
                normal
              );
              return point ? sign * point.sub(base).dot(normal) : null;
            },
          };
          face.setDepth(depth);
          faces.push(face);
        });

        refreshEdges();
        group.add(box);
        boxes.push(box);
      });

      setBaseMapClipBoxFaces(faces);
      sceneManager.renderScene?.();
    })();

    return () => {
      cancelled = true;
      setBaseMapClipBoxFaces([]);
      boxes.forEach((box) => {
        box.parent?.remove(box);
        box.traverse((child) => child.userData?.dispose?.());
        disposeObject(box);
      });
      sceneManager.renderScene?.();
    };
  }, [enabled, idsKey, baseMapsUpdatedAt, annotationsLoadTick]);

  // render

  return null;
}
