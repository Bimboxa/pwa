import { useMemo } from "react";

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";

import useBlocks from "./useBlocks";
import useBlocksBaseMaps from "./useBlocksBaseMaps";
import getAnnotationQties from "Features/annotations/utils/getAnnotationQties";

import getBlockBoundsM from "../utils/getBlockBoundsM";
import sumBlockQties from "../utils/sumBlockQties";
import { isBlockInstanceAnnotation } from "../utils/blockTypes";

// Resolved definitions of the blocks of the scope — what every instance of a
// block draws. ONE useAnnotationsV2 over the blocks base maps, grouped by
// block: an edit of a member re-resolves that member only, and every
// instance follows.
//
// Returns [{ block, members, originPx, meterByPx, boundsM, totals }]:
//   members: the block's annotations drawn on its ORIGIN base map, resolved
//     in pixels — what the 2D editor draws;
//   allMembers: every annotation of the block, whatever its blocks base map
//     (an elevation…), each resolved in its own base map's pixels — what the
//     3D editor builds;
//   originPx: the insertion point in the same pixel frame;
//   meterByPx: scale of the origin base map;
//   boundsM: see getBlockBoundsM;
//   totals: {surface, length, membersCount} of ONE instance (see
//     sumBlockQties; 3D subtractions are not deducted here).
// Blocks with no origin or no scale are skipped (nothing to draw yet).
export default function useBlockDefinitions() {
  // data

  const blocks = useBlocks();
  const blocksBaseMaps = useBlocksBaseMaps();

  // helpers

  const baseMapIds = useMemo(
    () => (blocksBaseMaps ?? []).map((b) => b.id),
    [blocksBaseMaps]
  );
  const extraBaseMapIds = useMemo(() => baseMapIds.slice(1), [baseMapIds]);
  const enabled = baseMapIds.length > 0 && (blocks?.length ?? 0) > 0;

  const annotations = useAnnotationsV2({
    caller: "useBlockDefinitions",
    enabled,
    filterByBaseMapId: baseMapIds[0],
    extraBaseMapIds,
    filterBySelectedScope: true,
    hideBaseMapAnnotations: true,
  });

  // main

  return useMemo(() => {
    if (!enabled || !blocks?.length) return [];
    const baseMapById = {};
    (blocksBaseMaps ?? []).forEach((b) => (baseMapById[b.id] = b));

    const membersByBlockId = {};
    (annotations ?? []).forEach((a) => {
      if (!a?.blockId || isBlockInstanceAnnotation(a)) return;
      if (!membersByBlockId[a.blockId]) membersByBlockId[a.blockId] = [];
      membersByBlockId[a.blockId].push(a);
    });

    const definitions = [];
    blocks.forEach((block) => {
      const origin = block.origin;
      const baseMap = origin ? baseMapById[origin.baseMapId] : null;
      const width = baseMap?.refWidth ?? baseMap?.image?.imageSize?.width;
      const height = baseMap?.refHeight ?? baseMap?.image?.imageSize?.height;
      const meterByPx = baseMap?.meterByPx;
      if (!(width > 0) || !(height > 0) || !(meterByPx > 0)) return;

      const originPx = { x: origin.x * width, y: origin.y * height };
      const allMembers = membersByBlockId[block.id] ?? [];
      const members = allMembers.filter(
        (a) => a.baseMapId === origin.baseMapId
      );
      definitions.push({
        block,
        members,
        allMembers,
        originPx,
        meterByPx,
        boundsM: getBlockBoundsM({ members, originPx, meterByPx }),
        // what ONE instance of the block counts for
        totals: sumBlockQties(
          members.map((annotation) =>
            getAnnotationQties({
              annotation,
              meterByPx,
              imageSize: { width, height },
            })
          )
        ),
      });
    });
    return definitions;
  }, [enabled, blocks, blocksBaseMaps, annotations]);
}
