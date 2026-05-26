import { useCallback, useEffect, useRef, useState } from "react";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { Box, Dialog } from "@mui/material";

import useCreateBaseMapFromImage from "Features/baseMaps/hooks/useCreateBaseMapFromImage";

import { OrthoIGN } from "Features/leafletEditor/data/tileLayers";
import latLongToLength from "Features/leafletEditor/utils/latLongToLength";

import fetchIgnStaticImage from "../services/fetchIgnStaticImage";

import ToolbarSearchAddress from "./ToolbarSearchAddress";
import ToolbarNameAndCreate from "./ToolbarNameAndCreate";
import ButtonCloseSatelliteDialog from "./ButtonCloseSatelliteDialog";

const INITIAL_CENTER = [48.683619, 2.192905];
const INITIAL_ZOOM = 20;
const CAPTURE_WIDTH_PX = 2048;

export default function DialogCreateBaseMapFromSatellite({
  open,
  onClose,
  listing,
  onCreated,
}) {
  // refs

  const mapRef = useRef(null);
  const containerRef = useRef(null);

  // state

  const [isCreating, setIsCreating] = useState(false);

  // data

  const createBaseMapFromImage = useCreateBaseMapFromImage();

  // callback ref — init Leaflet as soon as the div is attached,
  // tear down when it detaches (immune to HMR / Dialog transition timing)

  const mapDivCallbackRef = useCallback((el) => {
    if (!el) return undefined;

    // eslint-disable-next-line no-console
    console.log("[satellite] map div attached", {
      w: el.clientWidth,
      h: el.clientHeight,
    });

    const map = L.map(el, {
      zoom: INITIAL_ZOOM,
      center: INITIAL_CENTER,
      layers: [OrthoIGN],
      zoomControl: false,
      attributionControl: false,
    });
    mapRef.current = map;

    // eslint-disable-next-line no-console
    console.log("[satellite] L.map created, internal size:", map.getSize());

    const t1 = setTimeout(() => {
      map.invalidateSize();
      // eslint-disable-next-line no-console
      console.log(
        "[satellite] invalidateSize @50ms",
        el.clientWidth,
        el.clientHeight,
        "->",
        map.getSize()
      );
    }, 50);
    const t2 = setTimeout(() => {
      map.invalidateSize();
      // eslint-disable-next-line no-console
      console.log("[satellite] invalidateSize @350ms ->", map.getSize());
    }, 350);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      map.remove();
      mapRef.current = null;
      // eslint-disable-next-line no-console
      console.log("[satellite] map removed");
    };
  }, []);

  // effect — keep map sized to the dialog on any subsequent resize

  useEffect(() => {
    if (!open || !containerRef.current) return undefined;

    const ro = new ResizeObserver(() => {
      mapRef.current?.invalidateSize();
    });
    ro.observe(containerRef.current);

    return () => ro.disconnect();
  }, [open]);

  // handlers

  const handleLatLongChange = useCallback((lat, lng) => {
    if (lat == null || lng == null || !mapRef.current) return;
    mapRef.current.flyTo([lat, lng], mapRef.current.getZoom(), {
      animate: true,
      duration: 1.5,
    });
  }, []);

  async function handleCreate({ name }) {
    if (isCreating) return;
    const map = mapRef.current;
    if (!map) return;

    setIsCreating(true);
    try {
      const bounds = map.getBounds();
      const mapEl = map.getContainer();
      const aspectRatio = mapEl.clientWidth / Math.max(mapEl.clientHeight, 1);
      const width = CAPTURE_WIDTH_PX;
      const height = Math.max(1, Math.round(width / aspectRatio));

      const file = await fetchIgnStaticImage({
        bounds,
        width,
        height,
        name: `${name || "image-satellite"}.png`,
      });

      const topLeft = bounds.getNorthWest();
      const topRight = bounds.getNorthEast();
      const viewportWidthMeters = latLongToLength(
        { lat: topLeft.lat, long: topLeft.lng },
        { lat: topRight.lat, long: topRight.lng }
      );
      const meterByPx =
        width > 0 && viewportWidthMeters
          ? viewportWidthMeters / width
          : undefined;

      const entity = await createBaseMapFromImage({
        file,
        name,
        listing,
        meterByPx,
        latLng: {
          lat: topLeft.lat,
          lng: topLeft.lng,
          x: 0,
          y: 0,
        },
      });

      onCreated?.(entity);
    } catch (error) {
      console.error(
        "[DialogCreateBaseMapFromSatellite] create base map failed",
        error
      );
    } finally {
      setIsCreating(false);
    }
  }

  // render

  return (
    <Dialog open={open} onClose={onClose} fullScreen>
      <Box
        ref={containerRef}
        sx={{
          position: "relative",
          width: 1,
          flexGrow: 1,
          minHeight: 0,
          bgcolor: "grey.200",
          overflow: "hidden",
        }}
      >
        <Box
          ref={mapDivCallbackRef}
          sx={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
          }}
        />

        <Box sx={{ position: "absolute", top: 16, left: 16, zIndex: 1000 }}>
          <ToolbarSearchAddress onLatLongChange={handleLatLongChange} />
        </Box>

        <Box sx={{ position: "absolute", top: 16, right: 16, zIndex: 1000 }}>
          <ButtonCloseSatelliteDialog onClose={onClose} />
        </Box>

        <Box
          sx={{
            position: "absolute",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
          }}
        >
          <ToolbarNameAndCreate
            listing={listing}
            onCreate={handleCreate}
            isCreating={isCreating}
          />
        </Box>
      </Box>
    </Dialog>
  );
}
