import { useEffect, useMemo, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";

import db from "App/db/db";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useUserEmail from "Features/auth/hooks/useUserEmail";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";

import { triggerAnnotationTemplatesUpdate } from "Features/annotations/annotationsSlice";
import { getDefaultsForShape } from "Features/annotations/constants/drawingShapeConfig";
import getAnnotationTemplateCode from "Features/annotations/utils/getAnnotationTemplateCode";

// Free annotations ("Ligne" / "Surface") are not tied to a user-managed
// classification template. They are backed, per scope, by two hidden "system"
// annotationTemplates living in a dedicated system listing
// (isFreeAnnotationsListing). This hook idempotently provisions those records
// and exposes them so the panel rows and the L/S hotkeys can drive drawing.
//
// Records use deterministic ids so ensure-exists is safe across reloads and
// concurrent mounts (we only create when missing, never overwrite user edits).
export default function useFreeAnnotationTemplates() {
  const dispatch = useDispatch();

  // data

  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const appConfig = useAppConfig();
  const { value: createdBy } = useUserEmail();

  // deterministic ids

  const listingId = scopeId ? `${scopeId}_freeAnnotations` : null;
  const lineTemplateId = listingId ? `${listingId}_line` : null;
  const surfaceTemplateId = listingId ? `${listingId}_surface` : null;

  // ensure-exists

  const provisionedRef = useRef(null);

  useEffect(() => {
    if (!scopeId || !projectId || !listingId) return;
    // run once per (scope, project) pair
    const provisionKey = `${scopeId}:${projectId}`;
    if (provisionedRef.current === provisionKey) return;
    provisionedRef.current = provisionKey;

    const ensure = async () => {
      // system listing
      const existingListing = await db.listings.get(listingId);
      if (!existingListing) {
        const defaultEntityModel = Object.values(
          appConfig?.entityModelsObject ?? {}
        ).find((em) => em.isDefault && em.type === "LOCATED_ENTITY");
        await db.listings.put({
          id: listingId,
          projectId,
          scopeId,
          name: "Annotations libres",
          isFreeAnnotationsListing: true,
          canCreateItem: false,
          table: defaultEntityModel?.defaultTable ?? "entities",
          ...(defaultEntityModel ? { entityModel: defaultEntityModel } : {}),
          ...(defaultEntityModel?.key
            ? { entityModelKey: defaultEntityModel.key }
            : {}),
          sortedAnnotationIds: [],
          createdBy,
        });
      }

      // two system templates (one POLYLINE, one POLYGON)
      const drafts = [
        {
          id: lineTemplateId,
          label: "Ligne",
          drawingShape: "POLYLINE",
          type: "POLYLINE",
        },
        {
          id: surfaceTemplateId,
          label: "Surface",
          drawingShape: "POLYGON",
          type: "POLYGON",
        },
      ];
      for (const draft of drafts) {
        const existing = await db.annotationTemplates.get(draft.id);
        if (existing) continue;
        const template = {
          ...getDefaultsForShape(draft.drawingShape),
          ...draft,
          projectId,
          listingId,
          hidden: false,
          isFreeAnnotation: true,
          createdBy,
        };
        template.code = getAnnotationTemplateCode({
          annotation: template,
          listingKey: listingId,
        });
        await db.annotationTemplates.put(template);
      }

      dispatch(triggerAnnotationTemplatesUpdate());
    };

    ensure();
  }, [
    scopeId,
    projectId,
    listingId,
    lineTemplateId,
    surfaceTemplateId,
    appConfig,
    createdBy,
    dispatch,
  ]);

  // live templates

  const templates = useAnnotationTemplates({
    filterByListingId: listingId,
    sortByOrder: true,
  });

  const lineTemplate = useMemo(
    () => templates?.find((t) => t.id === lineTemplateId) ?? null,
    [templates, lineTemplateId]
  );
  const surfaceTemplate = useMemo(
    () => templates?.find((t) => t.id === surfaceTemplateId) ?? null,
    [templates, surfaceTemplateId]
  );

  return { listingId, lineTemplate, surfaceTemplate };
}
