import { useDispatch } from "react-redux";

import { triggerBaseMapsUpdate } from "Features/baseMaps/baseMapsSlice";

import db from "App/db/db";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import getBaseMapTransform from "Features/baseMaps/js/getBaseMapTransform";

import FieldAnnotationHeight from "Features/annotations/components/FieldAnnotationHeight";

export default function FieldBaseMapZInTopBar() {
  const dispatch = useDispatch();

  // data

  const baseMap = useMainBaseMap();

  // helpers

  const transform = baseMap ? getBaseMapTransform(baseMap) : null;

  // handlers

  async function handleChange(updated) {
    if (!baseMap?.id) return;
    const y = parseFloat(updated.z);
    if (!Number.isFinite(y)) return;
    const t = getBaseMapTransform(baseMap);
    await db.baseMaps.update(baseMap.id, {
      position: { ...t.position, y },
    });
    dispatch(triggerBaseMapsUpdate());
  }

  // render

  if (!baseMap?.id) return null;

  return (
    <FieldAnnotationHeight
      annotation={{ id: baseMap.id, z: transform.position.y }}
      field="z"
      label="Z"
      unit="m"
      onChange={handleChange}
    />
  );
}
