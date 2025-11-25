import { useRef } from "react";
import { Box } from "@mui/material";

import GoogleMap from "./GoogleMap";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

export default function PageGmap() {
  // handlers
  function handleCenterScroll() {
    const container = mapContainerRef.current;
    if (!container) return;

    // Log these to debug if needed:
    // console.log("ScrollHeight:", container.scrollHeight, "ClientHeight:", container.clientHeight);

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

  // refs
  const mapContainerRef = useRef(null);

  return (
    <Box
      sx={{
        width: "100%",
        // FIX 1: Use 100vh (Viewport Height) instead of 100% to force the container
        // to stay the size of the screen. If this component is inside a dashboard
        // with a header, calculate it (e.g., "calc(100vh - 64px)").
        height: "100vh",

        // FIX 2: Hidden overflow ensures the outer container doesn't create
        // the scrollbar, forcing the inner container to handle it.
        overflow: "hidden",

        display: "flex",
        flexDirection: "column",
        gap: 2,
        position: "relative",
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
        }}
      >
        <ButtonGeneric
          label="Center Scroll"
          onClick={handleCenterScroll}
          variant="contained"
          color="secondary"
        />
        <ButtonGeneric
          label="Reset Scroll"
          onClick={handleResetScroll}
          variant="outlined"
          color="secondary"
        />
      </Box>

      {/* Map Container - The Scrollable Area */}
      <Box
        sx={{
          flexGrow: 1,
          width: "100%",

          // FIX 3: Explicitly set overflow to auto here
          overflow: "auto",

          border: "1px solid #ccc",

          // FIX 4: This is crucial for Flex children.
          // It prevents the flex-item from defaulting to its content size (2000px).
          minHeight: 0,
        }}
        ref={mapContainerRef}
      >
        <Box
          sx={{
            width: 2048,
            height: 2048,
            // Ensure the map container doesn't shrink
            flexShrink: 0,
          }}
          position="relative"
        >
          <GoogleMap />
        </Box>
      </Box>
    </Box>
  );
}
