import { useState } from "react";

import { Box, Typography, CircularProgress } from "@mui/material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useSelectedProject from "Features/projects/hooks/useSelectedProject";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useCreateBaseMapFromImage from "Features/baseMaps/hooks/useCreateBaseMapFromImage";

import fetchGmapStaticImage, {
  GMAP_STATIC_SIZE,
  GMAP_STATIC_SCALE,
  GMAP_STATIC_MAPTYPE,
} from "../services/fetchGmapStaticImage";

import GoogleMap from "./GoogleMap";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

export default function SectionGmapEditor({ listing, onCreated }) {
  // strings

  const createS = "Créer le fond de plan";
  const errorS = "Échec de la récupération de l'image satellite";

  // state

  const [gmap, setGmap] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // data

  const appConfig = useAppConfig();
  const { value: project } = useSelectedProject();
  const { value: scope } = useSelectedScope();
  const createBaseMapFromImage = useCreateBaseMapFromImage();

  // helpers

  const jsApiKey = appConfig?.features?.gmap?.jsApiKey;
  const staticImageFetchParams =
    appConfig?.features?.gmap?.staticImage?.fetchParams;

  const listingName = listing?.name ?? "Fonds de plan";
  const subtitle = [project?.name, scope?.name].filter(Boolean).join(" • ");

  // handlers

  async function handleCreateClick() {
    if (!gmap || loading) return;
    const center = gmap.getCenter();
    if (!center) return;

    setLoading(true);
    setError(null);
    try {
      const { file, meterByPx, latLng } = await fetchGmapStaticImage({
        url: staticImageFetchParams?.url,
        method: staticImageFetchParams?.method,
        lat: center.lat(),
        lng: center.lng(),
        zoom: Math.round(gmap.getZoom()),
        size: GMAP_STATIC_SIZE,
        scale: GMAP_STATIC_SCALE,
        maptype: GMAP_STATIC_MAPTYPE,
      });

      const entity = await createBaseMapFromImage({
        file,
        name: listingName,
        listing,
        meterByPx,
        latLng,
      });

      onCreated?.(entity);
    } catch (e) {
      console.error("[SectionGmapEditor] create base map failed", e);
      setError(errorS);
    } finally {
      setLoading(false);
    }
  }

  // render

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box sx={{ width: 1, height: 1 }}>
        <GoogleMap
          apiKey={jsApiKey}
          onGmapChange={setGmap}
          showCaptureFootprint
        />
      </Box>

      {/* Bottom centered toolbar */}
      <Box
        sx={{
          position: "absolute",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1000,
          bgcolor: "white",
          borderRadius: 2,
          boxShadow: 3,
          px: 3,
          py: 1.5,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0.5,
          maxWidth: "90vw",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Typography sx={{ fontWeight: 600 }} noWrap>
            {listingName}
          </Typography>
          <ButtonGeneric
            label={createS}
            onClick={handleCreateClick}
            variant="contained"
            color="secondary"
            disabled={loading || !gmap || !staticImageFetchParams?.url}
            startIcon={
              loading ? (
                <CircularProgress size={16} color="inherit" />
              ) : undefined
            }
          />
        </Box>
        {subtitle && (
          <Typography sx={{ fontSize: 12, color: "text.disabled" }} noWrap>
            {subtitle}
          </Typography>
        )}
        {error && (
          <Typography sx={{ fontSize: 12, color: "error.main" }}>
            {error}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
