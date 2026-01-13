import { useRef, useState, useEffect } from "react";
import { Box, IconButton, Typography, Divider } from "@mui/material";
import { VisibilityOff, Visibility } from "@mui/icons-material";

import GoogleMap from "./GoogleMap";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import FieldCheck from "Features/form/components/FieldCheck";
import BoxAlignToRight from "Features/layout/components/BoxAlignToRight";

export default function PageGmap() {

  // refs
  const mapContainerRef = useRef(null);

  // state
  const [hideButtons, setHideButtons] = useState(false);
  const [hd, setHd] = useState(false);
  const [gmap, setGmap] = useState(null);
  const [widthInM, setWidthInM] = useState();
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);
  const [latLng, setLatLng] = useState({ lat: null, lng: null });

  // helpers
  const size = hd ? screenWidth * 2 : screenWidth;
  const meterByPx = widthInM && screenWidth
    ? (widthInM / screenWidth) / (window.devicePixelRatio >= 2 ? 2 : 1)
    : 0;

  // --- GESTION DE LA TAILLE DE L'ÉCRAN ---
  useEffect(() => {
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // handlers
  function handleBoundsChange(bounds) {
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const lat1 = sw.lat();
    const lat2 = ne.lat();
    const lng1 = sw.lng();
    const lng2 = ne.lng();
    const avgLat = (lat1 + lat2) / 2;
    const avgLatRad = (avgLat * Math.PI) / 180;
    const R = 6371000;
    const metersPerDegreeLng = R * Math.cos(avgLatRad) * (Math.PI / 180);
    const deltaLng = Math.abs(lng2 - lng1);
    const widthInMeters = deltaLng * metersPerDegreeLng;

    setWidthInM(widthInMeters);
    setLatLng({ lat: (lat1 + lat2) / 2, lng: (lng1 + lng2) / 2 });
  }

  function toggleHd() {
    setHd(!hd);
  }

  function handleCenterScroll() {
    const container = mapContainerRef.current;
    if (!container) return;
    const targetScrollLeft = Math.max(0, (container.scrollWidth - container.clientWidth) / 2);
    const targetScrollTop = Math.max(0, (container.scrollHeight - container.clientHeight) / 2);
    container.scrollTo({ left: targetScrollLeft, top: targetScrollTop, behavior: "smooth" });
  }

  function handleResetScroll() {
    const container = mapContainerRef.current;
    if (!container) return;
    container.scrollTo({ left: 0, top: 0, behavior: "smooth" });
  }

  function handleGetMapGeometry() {
    if (!gmap) return;
    const geometryString = `geo::${latLng.lat}::${latLng.lng}::${widthInM}`;
    navigator.clipboard.writeText(geometryString)
      .catch((err) => console.error("Failed to copy:", err));
  }

  function handleCopyScale() {
    if (!meterByPx) return;
    const scaleString = meterByPx.toString();
    navigator.clipboard.writeText(scaleString)
      .catch((err) => console.error("Failed to copy scale:", err));
  }

  return (
    <Box
      sx={{
        width: "100%",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        alignItems: "center",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          top: "8px",
          right: "8px",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          gap: 1,
          bgcolor: hideButtons ? "transparent" : "white",
          borderRadius: "8px",
          p: hideButtons ? 0 : 1,
        }}
      >
        {hideButtons ? (
          <BoxAlignToRight sx={{ opacity: 0.2 }}>
            <IconButton
              onClick={() => setHideButtons(false)}
              color="primary"
              sx={{ bgcolor: "rgba(255,255,255,0.8)", "&:hover": { bgcolor: "white" } }}
            >
              <Visibility />
            </IconButton>
          </BoxAlignToRight>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>

            <Typography variant="body2">{`Largeur : ${widthInM?.toFixed(2) ?? "-"}m`}</Typography>
            <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
              {`${latLng.lat?.toFixed(5) ?? "-"}, ${latLng.lng?.toFixed(5) ?? "-"}`}
            </Typography>

            <FieldCheck value={hd} onChange={toggleHd} label="Taille x2" options={{ type: "switch" }} />

            {/* 1. Centrer l'image */}
            <ButtonGeneric
              label="Centrer l'image"
              onClick={handleCenterScroll}
              variant="contained"
              color="secondary"
            />

            {/* 2. Copier l'échelle */}
            <ButtonGeneric
              label="Copier l'échelle"
              onClick={handleCopyScale}
              variant="outlined"
              color="secondary"
            />

            {/* 3. Tout masquer pour capture */}
            <ButtonGeneric
              label="Tout masquer pour capture"
              onClick={() => setHideButtons(true)}
              variant="text"
              color="primary"
              startIcon={<VisibilityOff />}
            />

            <Divider sx={{ my: 0.5 }} />

            {/* 4. Reset scroll */}
            <ButtonGeneric
              label="Reset scroll"
              onClick={handleResetScroll}
              variant="outlined"
              color="secondary"
            />

            {/* 5. Copier la géolocalisation */}
            <ButtonGeneric
              label="Copier la géolocalisation"
              onClick={handleGetMapGeometry}
              variant="outlined"
              color="secondary"
            />
          </Box>
        )}
      </Box>

      {/* Map Container */}
      <Box ref={mapContainerRef} sx={{
        display: "flex",
        width: 1, height: 1,
        minWidth: 0,
        minHeight: 0,
        alignItems: "flex-start",
        justifyContent: "flex-start",
        overflow: "auto"
      }}>
        <Box sx={{ height: 1, width: "100%", minHeight: 0, minWidth: 0, flexShrink: 0 }}>
          <Box sx={{ width: `${size}px`, height: `${size}px`, flexShrink: 0 }} position="relative">
            <GoogleMap
              hideButtons={hideButtons}
              onGmapChange={setGmap}
              onBoundsChange={handleBoundsChange}
              size={size}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}