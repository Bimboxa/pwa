import { nanoid } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";

import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";
import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import {
  setSelectedListingId,
  triggerListingsUpdate,
} from "Features/listings/listingsSlice";
import { hideLayerIds, triggerLayersUpdate } from "Features/layers/layersSlice";
import { setHiddenVersionIds } from "Features/baseMapEditor/baseMapEditorSlice";
import { selectLayersMode } from "Features/scopeConfig/utils/scopeConfigSelectors";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useUserEmail from "Features/auth/hooks/useUserEmail";
import useTriggerInitialScopeSaveIfNeeded from "Features/remoteScopeConfigurations/hooks/useTriggerInitialScopeSaveIfNeeded";
import useLogAppEvent from "Features/appLog/hooks/useLogAppEvent";

import db from "App/db/db";
import getDefaultLocatedEntityModel from "Features/listings/utils/getDefaultLocatedEntityModel";
import getEntityPureDataAndFilesDataByKey from "Features/entities/utils/getEntityPureDataAndFilesDataByKey";
import { renderDxfFile } from "../utils/renderDxf.js";
import buildDxfRecords from "../utils/buildDxfRecords.js";
import persistDxfImport from "../services/persistDxfImport.js";
import {
  createDefaultPrintZone,
  getPrintZonePxPerPt,
} from "Features/baseMaps/utils/printZone";

export default function useCreateBaseMapFromDxf() {
  const dispatch = useDispatch();
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const layersMode = useSelector(selectLayersMode);
  const appConfig = useAppConfig();
  const { value: createdBy } = useUserEmail();
  const triggerInitialSave = useTriggerInitialScopeSaveIfNeeded();
  const logAppEvent = useLogAppEvent();

  return async ({
    file,
    drawing,
    frame,
    hiddenLayers,
    name,
    unit,
    listing: baseMapsListing,
  }) => {
    if (
      !scopeId ||
      !projectId ||
      !baseMapsListing?.id ||
      baseMapsListing.projectId !== projectId
    ) {
      throw new Error("Sélectionnez un dossier et une liste de fonds de plan.");
    }
    if (!(unit?.meters > 0) || !name.trim())
      throw new Error("Renseignez le nom et l’unité du dessin.");
    const entityModel = getDefaultLocatedEntityModel(appConfig);
    if (!entityModel)
      throw new Error("Aucun modèle de liste d’annotations n’est configuré.");
    const baseMapId = nanoid(),
      listingId = nanoid();
    const annotationsVersionId = nanoid(),
      referenceVersionId = nanoid();
    const [referenceFile, blankFile] = await Promise.all([
      renderDxfFile(drawing, frame, hiddenLayers, `${name}.png`),
      renderDxfFile(
        { objects: [] },
        frame,
        new Set(),
        `${name}-annotations.png`
      ),
    ]);
    const { pureData, filesDataByKey } =
      await getEntityPureDataAndFilesDataByKey(
        {
          id: baseMapId,
          name: name.trim(),
          image: { file: blankFile },
          referenceImage: { file: referenceFile },
          dxfSource: { file },
        },
        {
          entityId: baseMapId,
          projectId,
          listingId: baseMapsListing.id,
          listingTable: "baseMaps",
          createdBy,
        }
      );
    const { referenceImage, dxfSource, ...mapData } = pureData;
    const printZone = createDefaultPrintZone({
      format: "A3",
      orientation: "landscape",
      imageSize: frame,
    });
    const records = buildDxfRecords({
      drawing,
      frame,
      baseMapId,
      listingId,
      projectId,
      scopeId,
      layersMode,
      hiddenLayers,
      pagePxPerPt: getPrintZonePxPerPt(printZone),
    });
    // Both versions have the same coordinates. The blank active image lets
    // editable annotations disappear completely when their layer is hidden.
    mapData.image.thumbnail = referenceImage.thumbnail;
    const baseMap = {
      ...mapData,
      listingId: baseMapsListing.id,
      createdBy,
      meterByPx: unit.meters / frame.scale,
      fromDXF: true,
      printZone,
      orientation: baseMapsListing.verticalBaseMaps ? "VERTICAL" : "HORIZONTAL",
      refWidth: frame.width,
      refHeight: frame.height,
      dxf: {
        fileName: dxfSource.fileName,
        srcFileName: file.name,
        listingId,
        unitCode: unit.code,
        metersPerUnit: unit.meters,
        frame,
        annotationsVersionId,
        referenceVersionId,
        layers: records.layers.map((layer) => ({
          name: layer.name,
          layerId: layer.id,
          initiallyHidden: layer.dxfInitiallyHidden,
        })),
        skipped: drawing.skipped,
        curvedCount: drawing.curvedCount,
        warnings: drawing.warnings,
      },
    };
    const listing = {
      id: listingId,
      projectId,
      scopeId,
      createdBy,
      name: `DXF — ${name.trim()}`,
      canCreateItem: true,
      table: entityModel.defaultTable ?? "entities",
      entityModel,
      entityModelKey: entityModel.key,
      fromDXF: true,
      dxfBaseMapId: baseMapId,
    };
    const version = {
      baseMapId,
      projectId,
      listingId: baseMapsListing.id,
      transform: { x: 0, y: 0, rotation: 0, scale: 1 },
    };
    await persistDxfImport(db, {
      baseMap,
      listing,
      ...records,
      layersMode,
      files: Object.values(filesDataByKey).flat(),
      versions: [
        {
          ...version,
          id: annotationsVersionId,
          label: "DXF — Annotations",
          fractionalIndex: "a0",
          isActive: true,
          image: mapData.image,
        },
        {
          ...version,
          id: referenceVersionId,
          label: "DXF — Image de référence",
          fractionalIndex: "a1",
          isActive: false,
          image: referenceImage,
        },
      ],
    });
    dispatch(
      hideLayerIds(
        records.layers
          .filter((layer) => layer.dxfInitiallyHidden)
          .map((layer) => layer.id)
      )
    );
    dispatch(setHiddenVersionIds([referenceVersionId]));
    dispatch(triggerLayersUpdate());
    dispatch(triggerListingsUpdate());
    dispatch(triggerEntitiesTableUpdate("baseMaps"));
    dispatch(triggerAnnotationsUpdate());
    dispatch(setSelectedListingId(listingId));
    dispatch(setSelectedMainBaseMapId(baseMapId));
    // Save only after the whole import committed, including its source file.
    triggerInitialSave();
    logAppEvent("BASE_MAP_CREATED", { name, source: "dxf", size: file.size });
    return baseMap;
  };
}
