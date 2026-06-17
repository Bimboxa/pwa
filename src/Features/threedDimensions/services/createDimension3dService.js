import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import {
  DEFAULT_COTE_COLOR,
  DEFAULT_COTE_DECIMALS,
  DEFAULT_COTE_UNIT,
} from "../utils/coteConstants";

// Persist a new 3D dimension ("cote"). Endpoints `a` / `b` are world-space
// {x, y, z}; `length` (meters) is cached at write time. Audit fields
// (createdAt / updatedAt / createdByUserIdMaster) are added by the db hooks.
export default async function createDimension3dService({
  projectId,
  scopeId,
  a,
  b,
}) {
  if (!projectId || !scopeId || !a || !b) return null;

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

  const dimension = {
    id: nanoid(),
    projectId,
    scopeId,
    a: { x: a.x, y: a.y, z: a.z },
    b: { x: b.x, y: b.y, z: b.z },
    length,
    // Display settings (editable from the cote toolbar).
    color: DEFAULT_COTE_COLOR,
    unit: DEFAULT_COTE_UNIT,
    decimals: DEFAULT_COTE_DECIMALS,
  };

  await db.dimensions3d.put(dimension);
  return await db.dimensions3d.get(dimension.id);
}
