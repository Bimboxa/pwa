import { useRef, useEffect, useState } from "react";

import getMapsApiAsync from "../services/getMapsApiAsync";
import {
  computeStaticMapGeo,
  GMAP_STATIC_SIZE,
  GMAP_STATIC_SCALE,
} from "../services/fetchGmapStaticImage";

export default function GoogleMap({
  onGmapChange,
  onGmapContainerChange,
  hideButtons,
  onBoundsChange,
  apiKey,
  showCaptureFootprint,
}) {
  const mapsRef = useRef();
  const mapInstanceRef = useRef(null);
  const mapRef = useRef(null);
  const footprintRef = useRef(null);

  // 1. Create a ref for the search input
  const searchInputRef = useRef(null);

  const [mapsLoaded, setMapsLoaded] = useState(false);

  useEffect(() => {
    if (!apiKey) return;
    initMapAsync();

    async function initMapAsync() {
      if (!mapsRef.current) {
        const maps = await getMapsApiAsync(apiKey);
        mapsRef.current = maps;
        setMapsLoaded(true);
      } else {
        setMapsLoaded(true);
      }
    }
  }, [apiKey]);

  useEffect(() => {
    if (
      mapsLoaded &&
      mapsRef.current &&
      !mapInstanceRef.current &&
      mapRef.current
    ) {
      const googleMaps = mapsRef.current;

      // Create the map
      const map = new googleMaps.Map(mapRef.current, {
        center: { lat: 48.683619, lng: 2.192905 }, // Default: Paris
        zoom: 18,
        fullscreenControl: false,
        mapTypeControl: false,
        streetViewControl: false, // Removes the Street View pegman
        zoomControl: false, // Removes zoom +/- buttons
        rotateControl: false, // Removes rotate control
        scaleControl: false, // Removes scale control
        mapTypeId: "satellite",
        tilt: 0,
      });

      mapInstanceRef.current = map;

      // --- CAPTURE FOOTPRINT (red square = exact static-image area) ---
      if (showCaptureFootprint) {
        footprintRef.current = new googleMaps.Rectangle({
          map,
          strokeColor: "#F44336",
          strokeOpacity: 1,
          strokeWeight: 2,
          fillOpacity: 0,
          clickable: false,
          zIndex: 9999,
        });
      }

      function updateFootprint() {
        if (!footprintRef.current) return;
        const center = map.getCenter();
        if (!center) return;
        const { bounds } = computeStaticMapGeo({
          lat: center.lat(),
          lng: center.lng(),
          zoom: Math.round(map.getZoom()),
          size: GMAP_STATIC_SIZE,
          scale: GMAP_STATIC_SCALE,
        });
        footprintRef.current.setBounds(bounds);
      }

      // --- SEARCH BAR LOGIC ---

      if (googleMaps.places && searchInputRef.current) {
        // Create the SearchBox
        const searchBox = new googleMaps.places.SearchBox(
          searchInputRef.current
        );

        // Push the input into the Map's UI (Top Left)
        map.controls[googleMaps.ControlPosition.TOP_LEFT].push(
          searchInputRef.current
        );

        // Bias the SearchBox results towards current map's viewport.
        map.addListener("bounds_changed", () => {
          searchBox.setBounds(map.getBounds());
          updateFootprint();
          if (onBoundsChange) onBoundsChange(map.getBounds());
        });

        // Listen for the event fired when the user selects a prediction
        searchBox.addListener("places_changed", () => {
          const places = searchBox.getPlaces();

          if (places.length === 0) {
            return;
          }

          // For each place, get the icon, name and location.
          const bounds = new googleMaps.LatLngBounds();

          places.forEach((place) => {
            if (!place.geometry || !place.geometry.location) {
              console.log("Returned place contains no geometry");
              return;
            }

            if (place.geometry.viewport) {
              // Only geocodes have viewport.
              bounds.union(place.geometry.viewport);
            } else {
              bounds.extend(place.geometry.location);
            }
          });

          // Fit map to result
          map.fitBounds(bounds);
        });
      } else {
        console.error(
          "Google Maps 'places' library is missing. Add &libraries=places to your script URL."
        );
      }
      // ------------------------

      updateFootprint();

      if (onGmapChange) onGmapChange(map);
      if (onGmapContainerChange) onGmapContainerChange(mapRef.current);
    }
  }, [mapsLoaded, onGmapChange, onGmapContainerChange, showCaptureFootprint]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* The search input — once mounted into the map via map.controls it
          becomes part of the map UI. */}
      <input
        ref={searchInputRef}
        type="text"
        placeholder="Rechercher une adresse"
        style={{
          visibility: hideButtons ? "hidden" : "visible",
          boxSizing: "border-box",
          border: "1px solid transparent",
          width: "320px",
          height: "40px",
          marginTop: "10px",
          marginLeft: "10px",
          padding: "0 12px",
          borderRadius: "4px",
          boxShadow: "0 2px 6px rgba(0, 0, 0, 0.3)",
          fontSize: "14px",
          outline: "none",
          textOverflow: "ellipses",
          backgroundColor: "white",
        }}
      />

      <div
        ref={mapRef}
        style={{
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
}
