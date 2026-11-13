import { nanoid } from "@reduxjs/toolkit";
import { useDispatch } from "react-redux";
import { generateKeyBetween } from "fractional-indexing";

import useCreateEntities from "Features/entities/hooks/useCreateEntities";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import { triggerAnnotationTemplatesUpdate } from "../annotationsSlice";
import getAnnotationTemplateCode from "../utils/getAnnotationTemplateCode";
import db from "App/db/db";
import imageUrlToPng from "Features/images/utils/imageUrlToPng";
import ImageObject from "Features/images/js/ImageObject";
import createObject3DEntityField from "Features/object3D/utils/createObject3DEntityField";

// OBJECT_3D library template: `object3D: { fileUrlClient, fileName? }` (a
// bundled .glb url) → the object3D entity field (file, bbox, top view), the
// same one the « Nouveau modèle » form builds. Null when it cannot be loaded.
async function buildObject3DFieldFromUrl({ fileUrlClient, fileName }) {
  try {
    const res = await fetch(fileUrlClient);
    if (!res.ok) return null;
    const blob = await res.blob();
    const name =
      fileName ?? fileUrlClient.split("/").pop()?.split("?")[0] ?? "object.glb";
    const file = new File([blob], name.endsWith(".glb") ? name : "object.glb", {
      type: "model/gltf-binary",
    });
    return await createObject3DEntityField(file);
  } catch (error) {
    console.warn("[AnnotationTemplates] 3D file not loaded", error);
    return null;
  }
}

export default function useCreateAnnotationTemplatesFromLibrary() {
  const dispatch = useDispatch();
  const createEntities = useCreateEntities();
  const createEntity = useCreateEntity();

  return async (annotationTemplatesFromLibrary, options) => {
    console.log(
      "[AnnotationTemplates] create from library",
      annotationTemplatesFromLibrary
    );

    const listingId = options?.listingId;
    const projectId = options?.projectId;
    const listing = { id: listingId, projectId, table: "annotationTemplates" };

    // separate templates with/without files (image, 3D object)
    const bulkItems = [];
    const templatesWithFiles = [];

    // Ids are minted up front so a template can reference another one of the
    // same batch by its library key (`templateKey`) — the path array default
    // of a POLYLINE template (Features/pathArray): `pathArray: { step,
    // annotationTemplateKey }` → `{ step, annotationTemplateId }`. A reference
    // to a template left out of the batch drops the path array.
    const batch = annotationTemplatesFromLibrary.map((libraryTemplate) => ({
      libraryTemplate,
      id: nanoid(),
    }));
    const idByTemplateKey = new Map(
      batch
        .filter(({ libraryTemplate }) => libraryTemplate?.templateKey)
        .map(({ libraryTemplate, id }) => [libraryTemplate.templateKey, id])
    );
    const resolveLibraryRefs = (template) => {
      const next = { ...template };
      delete next.templateKey;
      const key = next.pathArray?.annotationTemplateKey;
      if (!key) return next;
      const annotationTemplateId = idByTemplateKey.get(key);
      if (annotationTemplateId)
        next.pathArray = { step: next.pathArray.step, annotationTemplateId };
      else delete next.pathArray;
      return next;
    };

    // SYSTEM templates (Features/systems) reference their system listing by
    // key in the libraries: resolved to the listing of the same scope.
    const hostListing = annotationTemplatesFromLibrary.some(
      (t) => t?.systemListingKey
    )
      ? await db.listings.get(listingId)
      : null;
    const resolveSystemListing = async (template) => {
      if (!template?.systemListingKey) return template;
      const { systemListingKey, ...rest } = template;
      const systemListing = await db.listings
        .where("key")
        .equals(systemListingKey)
        .filter(
          (l) =>
            !l.deletedAt &&
            l.projectId === projectId &&
            l.scopeId === hostListing?.scopeId
        )
        .first();
      return systemListing
        ? { ...rest, systemListingId: systemListing.id }
        : rest;
    };

    let lastIndex = null;
    for (const { libraryTemplate, id } of batch) {
      const rawTemplate = resolveLibraryRefs(
        await resolveSystemListing(libraryTemplate)
      );
      const orderIndex = generateKeyBetween(lastIndex, null);
      lastIndex = orderIndex;

      if (
        rawTemplate.image?.imageUrlClient ||
        rawTemplate.object3D?.fileUrlClient
      ) {
        // templates with files need async processing — handle individually
        templatesWithFiles.push({ ...rawTemplate, id, orderIndex });
      } else {
        // prepare template for bulk insert
        const template = {
          ...rawTemplate,
          id,
          projectId,
          listingId,
          orderIndex,
          code: getAnnotationTemplateCode({
            annotation: rawTemplate,
            listingKey: listingId,
          }),
        };
        bulkItems.push({ data: template, listing });
      }
    }

    // bulk insert templates without images
    if (bulkItems.length > 0) {
      await createEntities(bulkItems, { table: "annotationTemplates" });
      dispatch(triggerAnnotationTemplatesUpdate());
    }

    // handle templates with files individually (rare). createEntity keeps
    // the minted id and stores the files in db.files.
    for (const rawTemplate of templatesWithFiles) {
      let annotationTemplate = { ...rawTemplate };
      if (annotationTemplate.image?.imageUrlClient) {
        const file = await imageUrlToPng({
          url: annotationTemplate.image.imageUrlClient,
          name: "image.png",
        });
        if (file) {
          const image = await ImageObject.create({ imageFile: file });
          annotationTemplate.image = image.toEntityField();
        }
      }
      if (annotationTemplate.object3D?.fileUrlClient) {
        const object3D = await buildObject3DFieldFromUrl(
          annotationTemplate.object3D
        );
        // Without its model the template is still created (the file can be
        // set from its form).
        if (object3D) annotationTemplate.object3D = object3D;
        else delete annotationTemplate.object3D;
      }
      await createEntity(
        {
          ...annotationTemplate,
          projectId,
          listingId,
          code: getAnnotationTemplateCode({
            annotation: annotationTemplate,
            listingKey: listingId,
          }),
        },
        { listing }
      );
    }
    if (templatesWithFiles.length > 0)
      dispatch(triggerAnnotationTemplatesUpdate());
  };
}
