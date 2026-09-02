import { nanoid } from "nanoid";
import { generateKeyBetween } from "fractional-indexing";

import { useDispatch } from "react-redux";

import { triggerBusinessObjectsUpdate } from "../businessObjectsSlice";

import db from "App/db/db";

import {
  DEFAULT_BUSINESS_OBJECT_COLOR,
  DEFAULT_BUSINESS_OBJECT_UNIT,
} from "../constants/businessObjectEntityModel";

export default function useCreateBusinessObject() {
  const dispatch = useDispatch();

  const create = async ({
    listing,
    parentId,
    label,
    color,
    description,
    unit,
    isTitle,
  }) => {
    const listingId = listing.id;
    const projectId = listing.projectId;
    const scopeId = listing.scopeId;

    // sortIndex after the last sibling (fractional indexing)
    const siblings = (
      await db.businessObjects.where("listingId").equals(listingId).toArray()
    ).filter(
      (o) => !o.deletedAt && (o.parentId ?? null) === (parentId ?? null)
    );
    const lastSortIndex = siblings
      .map((o) => o.sortIndex)
      .filter((s) => s != null)
      .sort((a, b) => String(a).localeCompare(String(b)))
      .pop();

    const businessObject = {
      id: nanoid(),
      listingId,
      projectId,
      scopeId,
      parentId: parentId ?? null,
      label: label || "Nouvel ouvrage",
      color: color || DEFAULT_BUSINESS_OBJECT_COLOR,
      ...(description ? { description } : {}),
      ...(isTitle ? { isTitle: true } : {}),
      sortIndex: generateKeyBetween(lastSortIndex ?? null, null),
      // unit is nullable (unit-less rows, e.g. titles): null passes through,
      // only an omitted unit falls back to the default.
      unit: unit === undefined ? DEFAULT_BUSINESS_OBJECT_UNIT : unit,
    };

    await db.businessObjects.add(businessObject);

    dispatch(triggerBusinessObjectsUpdate());

    return businessObject;
  };

  return create;
}
