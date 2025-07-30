import { nanoid } from "@reduxjs/toolkit";
import db from "App/db/db";

export default async function createBaseMapViewService({
  scopeId,
  name,
  documentSize,
  bgImage,
}) {
  const id = nanoid();

  return await db.baseMapViews.add({
    id,
    scopeId,
    name,
    documentSize,
    bgImage,
  });
}
