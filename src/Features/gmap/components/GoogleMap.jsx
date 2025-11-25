import { useRef, useEffect, useState } from "react";
import getMapsApiAsync from "../services/getMapsApiAsync";

export default function GoogleMap({ onGmapChange, onGmapContainerChange }) {
  const mapsRef = useRef();
  const mapInstanceRef = useRef(null);
  const mapRef = useRef(null);

  // 1. Create a ref for the search input
  const searchInputRef = useRef(null);

  const [mapsLoaded, setMapsLoaded] = useState(false);

  useEffect(() => {
    initMapAsync();

    async function initMapAsync() {
      if (!mapsRef.current) {
        const maps = await getMapsApiAsync();
        mapsRef.current = maps;
        setMapsLoaded(true);
      } else {
        setMapsLoaded(true);
      }
    }
  }, []);

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
        mapTypeId: "satellite",
        tilt: 0,
      });

      mapInstanceRef.current = map;

      // --- SEARCH BAR LOGIC ---

      // 2. Check if the Places library is loaded
      if (googleMaps.places) {
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

          // Optional: Force zoom to 19 or 20 if fitBounds zooms out too much
          // map.setZoom(18);
        });
      } else {
        console.error(
          "Google Maps 'places' library is missing. Add &libraries=places to your script URL."
        );
      }
      // ------------------------

      if (onGmapChange) onGmapChange(map);
      if (onGmapContainerChange) onGmapContainerChange(mapRef.current);
    }
  }, [mapsLoaded, onGmapChange, onGmapContainerChange]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* 3. The Search Input 
        We give it generic styles here, but once mounted into the map
        via map.controls, it becomes part of the map UI.
      */}
      <input
        ref={searchInputRef}
        type="text"
        placeholder="Search Box"
        style={{
          boxSizing: "border-box",
          border: "1px solid transparent",
          width: "240px",
          height: "32px",
          marginTop: "10px",
          marginLeft: "10px",
          padding: "0 12px",
          borderRadius: "3px",
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
