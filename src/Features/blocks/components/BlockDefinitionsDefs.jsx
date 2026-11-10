import { useEffect } from "react";

import NodeAnnotationStatic from "Features/mapEditorGeneric/components/NodeAnnotationStatic";

import useBlockDefinitions from "../hooks/useBlockDefinitions";
import {
  getBlockDefId,
  setBlockDefinitionsInStore,
} from "../js/blockDefinitionsStore";
import { getBlockDefinitionTransform } from "../utils/blockInstanceGeometry";

// The geometry of every block of the scope, rendered ONCE in a hidden <svg>
// <defs>: each instance (NodeBlockInstanceStatic) is a single <use> pointing
// at its block's <g>. React renders the members once per block, whatever the
// number of instances, and an edit of a member re-renders one node here —
// the browser repaints every <use>.
//
// Each definition group is expressed in the BLOCK FRAME, in meters (insertion
// point at 0,0), so an instance only needs translate / rotate / scale(1 /
// host meterByPx).
//
// hostMeterByPx / hostContainerK: scale and pose scale of the base map the
// instances are drawn on. They only feed the screen-fixed sizes of the member
// nodes (hit widths, patterns): containerK = host k × (block px → host px).
export default function BlockDefinitionsDefs({
  hostMeterByPx,
  hostContainerK = 1,
}) {
  // data

  const definitions = useBlockDefinitions();

  // effects - publish the definitions (bounds) to the instance nodes

  useEffect(() => {
    const byBlockId = {};
    definitions.forEach((d) => {
      byBlockId[d.block.id] = {
        blockId: d.block.id,
        defId: getBlockDefId(d.block.id),
        label: d.block.label,
        boundsM: d.boundsM,
        membersCount: d.members.length,
        totals: d.totals,
      };
    });
    setBlockDefinitionsInStore(byBlockId);
  }, [definitions]);

  useEffect(() => () => setBlockDefinitionsInStore({}), []);

  // render

  if (definitions.length === 0) return null;

  return (
    <svg
      width={0}
      height={0}
      aria-hidden="true"
      style={{ position: "absolute", overflow: "hidden", pointerEvents: "none" }}
    >
      <defs>
        {definitions.map((d) => {
          const containerK =
            hostMeterByPx > 0
              ? hostContainerK * (d.meterByPx / hostMeterByPx)
              : hostContainerK;
          return (
            <g
              key={d.block.id}
              id={getBlockDefId(d.block.id)}
              transform={getBlockDefinitionTransform(d)}
            >
              {d.members.map((member) => (
                <NodeAnnotationStatic
                  key={member.id}
                  annotation={member}
                  containerK={containerK}
                  baseMapMeterByPx={d.meterByPx}
                  forceHideLabel={true}
                />
              ))}
            </g>
          );
        })}
      </defs>
    </svg>
  );
}
