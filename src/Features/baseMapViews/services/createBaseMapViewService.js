import { nanoid } from "@reduxjs/toolkit";
import db from "App/db/db";

export default async function createBaseMapViewService({
  scopeId,
  name,
  documentSize,
  bgImage,
  baseMap,
}) {
  const id = nanoid();

  if (!baseMap?.id) return;

  return await db.baseMapViews.add({
    id,
    scopeId,
    name,
    documentSize,
    bgImage,
    baseMap: { id: baseMap.id },
  });
}
