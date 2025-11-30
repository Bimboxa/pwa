import { useState } from "react";

import { useDispatch } from "react-redux";

import { setSelectedViewerKey } from "Features/viewers/viewersSlice";
import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";
import { setSelectedEntityId } from "Features/entities/entitiesSlice";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import getImageFromElement from "../../misc/utils/getImageFromElement";
import imageUrlToPng from "Features/images/utils/imageUrlToPng";
import ImageObject from "Features/images/js/ImageObject";
import latLongToLength from "../utils/latLongToLength";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import getSquareImageFile from "Features/images/utils/getSquareImageFile";

export default function ButtonCreateBaseMapFromLeaflet({ mapRef }) {
  const dispatch = useDispatch();

  // string

  const createS = "Créer un fond de plan";

  // data

  const { value: listing } = useSelectedListing();
  const createEntity = useCreateEntity();

  // state

  const [isCapturing, setIsCapturing] = useState(false);

  // handlers

  async function handleClick() {
    if (isCapturing) return;

    const mapInstance = mapRef?.current;
    const mapElement = mapInstance?.getContainer();

    if (!mapInstance) {
      console.warn("Leaflet map instance not ready");
      return;
    }

    if (!mapElement) {
      console.warn("Leaflet map container not found");
      return;
    }

    try {
      setIsCapturing(true);
      const result = await getImageFromElement(mapElement);

      let file = await imageUrlToPng({
        url: result.url,
        name: "image-satellite.png",
      });

      file = await getSquareImageFile(file);

      console.log("debug_2011_file", file);

      const image = await ImageObject.create({
        imageFile: file,
      });
      const { width, height } = image.imageSize;

      const bounds = mapInstance.getBounds();
      const topLeftLatLng = bounds.getNorthWest();
      const topRightLatLng = bounds.getNorthEast();

      const topLeftPoint = {
        lat: topLeftLatLng.lat,
        long: topLeftLatLng.lng,
      };
      const topRightPoint = {
        lat: topRightLatLng.lat,
        long: topRightLatLng.lng,
      };

      const viewportWidthMeters = latLongToLength(topLeftPoint, topRightPoint);
      const meterByPx =
        width > 0 && viewportWidthMeters
          ? viewportWidthMeters / width
          : undefined;

      if (listing) {
        const name = file.name.replace(/\.[^/.]+$/, "");
        const entity = {
          name,
          image: { file },
          meterByPx,
          latLng:{
            lat: topLeftLatLng.lat,
            lng: topLeftLatLng.lng,
            x:0,
            y:0
          }
        };
        const _entity = await createEntity(entity, { listing });

        dispatch(setSelectedMainBaseMapId(_entity?.id));
        dispatch(setSelectedEntityId(_entity?.id));

        dispatch(setSelectedViewerKey("MAP"));

        if (onClose) onClose();
      }
    } catch (error) {
      console.error("Failed to download map image:", error);
    } finally {
      setIsCapturing(false);
    }
  }

  return (
    <ButtonGeneric
      onClick={handleClick}
      label={createS}
      loading={isCapturing}
      variant="contained"
      color="secondary"
    />
  );
}
