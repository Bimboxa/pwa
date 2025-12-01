import { useRef, useState, useEffect } from "react";
import { Box, IconButton, Typography } from "@mui/material";
import { FullscreenExit, Fullscreen, Close } from "@mui/icons-material";

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
  const [screenWidth, setScreenWidth] = useState(window.innerWidth); // Initialisation
  const [latLng, setLatLng] = useState({ lat: null, lng: null });

  // helpers
  //const size = hd ? 2048 : 1024;
  const size = hd ? screenWidth * 2 : screenWidth;

  // --- NOUVEAU: GESTION DE LA TAILLE DE L'ÉCRAN ---
  useEffect(() => {
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  // ---------------------------------------------------


  // handlers
  function handleBoundsChange(bounds) {
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();

    // 1. Get coordinates
    const lat1 = sw.lat(); // Southernmost latitude
    const lat2 = ne.lat(); // Northernmost latitude
    const lng1 = sw.lng(); // Westernmost longitude
    const lng2 = ne.lng(); // Easternmost longitude

    // 2. Calculate average latitude in radians
    const avgLat = (lat1 + lat2) / 2;
    const avgLatRad = (avgLat * Math.PI) / 180;

    // 3. Calculate distance between longitudes using the average latitude
    const R = 6371000;
    const metersPerDegreeLng = R * Math.cos(avgLatRad) * (Math.PI / 180);

    // 4. Calculate the width in meters
    const deltaLng = Math.abs(lng2 - lng1);
    const widthInMeters = deltaLng * metersPerDegreeLng;

    // Set the state
    setWidthInM(widthInMeters);
    setLatLng({ lat: (lat1 + lat2) / 2, lng: (lng1 + lng2) / 2 });
  }

  function toggleHd() {
    setHd(!hd);
  }
  // --- NOUVEAU: GESTION DU SCROLL ---
  function handleCenterScroll() {
    const container = mapContainerRef.current;
    if (!container) return;

    const targetScrollLeft = Math.max(
      0,
      (container.scrollWidth - container.clientWidth) / 2
    );
    const targetScrollTop = Math.max(
      0,
      (container.scrollHeight - container.clientHeight) / 2
    );

    container.scrollTo({
      left: targetScrollLeft,
      top: targetScrollTop,
      behavior: "smooth",
    });
  }

  function handleResetScroll() {
    const container = mapContainerRef.current;
    if (!container) return;

    container.scrollTo({
      left: 0,
      top: 0,
      behavior: "smooth",
    });
  }

  function handleGetMapGeometry() {
    if (!gmap) {
      console.error("Map instance not available");
      return;
    }

    const geometryString = `geo::${latLng.lat}::${latLng.lng}::${widthInM}`;

    // Copy to clipboard
    navigator.clipboard.writeText(geometryString)
      .then(() => {
        console.log("Geometry string copied to clipboard:", geometryString);
      })
      .catch((err) => {
        console.error("Failed to copy to clipboard:", err);
      });

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
          p: 1,
        }}
      >
        <BoxAlignToRight>
          <IconButton
            onClick={() => setHideButtons(!hideButtons)}
            color="primary"
          >
            {hideButtons ? <FullscreenExit /> : <Close />}
          </IconButton>
        </BoxAlignToRight>
        <Box sx={{
          display: hideButtons ? "none" : "flex",
          flexDirection: "column",
          gap: 1,
        }}>
          <Typography variant="body2">{`Largeur : ${widthInM?.toFixed(2) ?? "-"}m`}</Typography>
          <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{`${latLng.lat?.toFixed(5) ?? "-"}, ${latLng.lng?.toFixed(5) ?? "-"}`}</Typography>
          <FieldCheck value={hd} onChange={toggleHd} label="Taille x2" options={{ type: "switch" }} />
          <ButtonGeneric
            label="Centrer l'image"
            onClick={handleCenterScroll}
            variant="contained"
            color="secondary"
          />
          <ButtonGeneric
            label="Reset scroll"
            onClick={handleResetScroll}
            variant="outlined"
            color="secondary"
          />
          <ButtonGeneric
            label="Copier la géolocalisation"
            onClick={handleGetMapGeometry}
            variant="outlined"
            color="secondary"
          />
        </Box>

      </Box>

      {/* Map Container - The Scrollable Area */}
      <Box ref={mapContainerRef} sx={{
        display: "flex",
        width: 1, height: 1,
        minWidth: 0,
        minHeight: 0,
        // Correction pour le scroll: Alignement au début pour atteindre le scroll: 0
        alignItems: "flex-start",
        justifyContent: "flex-start",

        overflow: "auto"
      }}>
        <Box
          sx={{
            height: 1,
            width: "100%",
            minHeight: 0,
            minWidth: 0,
            flexShrink: 0
          }}
        >
          <Box
            sx={{
              width: `${size}px`,
              height: `${size}px`,
              flexShrink: 0,
            }}
            position="relative"
          >
            <GoogleMap
              hideButtons={hideButtons}
              onGmapChange={setGmap}
              onBoundsChange={handleBoundsChange}
              size={size} // Passer la taille au composant GoogleMap
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}