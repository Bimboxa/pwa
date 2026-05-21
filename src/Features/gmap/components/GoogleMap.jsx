import { useRef, useEffect, useState } from "react";

import { Autocomplete, TextField, Box } from "@mui/material";

import getMapsApiAsync from "../services/getMapsApiAsync";

export default function GoogleMap({
  onGmapChange,
  onGmapContainerChange,
  hideButtons,
  onBoundsChange,
  apiKey,
}) {
  const mapsRef = useRef();
  const mapInstanceRef = useRef(null);
  const mapRef = useRef(null);

  const autocompleteServiceRef = useRef(null);
  const placesServiceRef = useRef(null);
  const sessionTokenRef = useRef(null);

  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [options, setOptions] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);

  useEffect(() => {
    if (!apiKey) return;
    initMapAsync();

    async function initMapAsync() {
      if (!mapsRef.current) {
        const maps = await getMapsApiAsync(apiKey);
        mapsRef.current = maps;
        if (maps?.places) {
          autocompleteServiceRef.current =
            new maps.places.AutocompleteService();
          sessionTokenRef.current = new maps.places.AutocompleteSessionToken();
        }
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

      map.addListener("bounds_changed", () => {
        if (onBoundsChange) onBoundsChange(map.getBounds());
      });

      if (googleMaps.places) {
        placesServiceRef.current = new googleMaps.places.PlacesService(map);
      }

      if (onGmapChange) onGmapChange(map);
      if (onGmapContainerChange) onGmapContainerChange(mapRef.current);
    }
  }, [mapsLoaded, onGmapChange, onGmapContainerChange]);

  // Fetch predictions as the user types (debounced)
  useEffect(() => {
    if (
      !autocompleteServiceRef.current ||
      !inputValue ||
      inputValue.length < 3
    ) {
      setOptions([]);
      return;
    }

    let active = true;
    const handle = setTimeout(() => {
      const map = mapInstanceRef.current;
      const bounds = map?.getBounds?.();
      autocompleteServiceRef.current.getPlacePredictions(
        {
          input: inputValue,
          types: ["geocode"],
          sessionToken: sessionTokenRef.current ?? undefined,
          ...(bounds ? { locationBias: bounds } : {}),
        },
        (predictions) => {
          if (active) setOptions(predictions || []);
        }
      );
    }, 200);

    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [inputValue]);

  // Resolve a selected prediction → recenter/zoom map
  useEffect(() => {
    if (!selectedPlace || typeof selectedPlace === "string") return;
    const placeId = selectedPlace.place_id;
    if (!placeId) return;
    const map = mapInstanceRef.current;
    const placesService = placesServiceRef.current;
    if (!map || !placesService) return;

    placesService.getDetails(
      {
        placeId,
        fields: ["geometry"],
        sessionToken: sessionTokenRef.current ?? undefined,
      },
      (place, status) => {
        // Session is consumed by getDetails — start a fresh one for the next search.
        if (mapsRef.current?.places) {
          sessionTokenRef.current =
            new mapsRef.current.places.AutocompleteSessionToken();
        }
        if (status !== mapsRef.current?.places?.PlacesServiceStatus?.OK) return;
        if (!place?.geometry) return;
        if (place.geometry.viewport) {
          map.fitBounds(place.geometry.viewport);
        } else if (place.geometry.location) {
          map.setCenter(place.geometry.location);
          map.setZoom(18);
        }
      }
    );
  }, [selectedPlace]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {!hideButtons && (
        <Box
          sx={{
            position: "absolute",
            top: "10px",
            left: "10px",
            width: 320,
            zIndex: 2,
          }}
        >
          <Autocomplete
            freeSolo
            filterOptions={(x) => x}
            options={options}
            inputValue={inputValue}
            onInputChange={(_, value) => setInputValue(value)}
            value={selectedPlace}
            onChange={(_, value) => setSelectedPlace(value)}
            getOptionLabel={(option) =>
              typeof option === "string" ? option : option.description ?? ""
            }
            renderOption={(props, option) => (
              <li {...props} key={option.place_id}>
                {option.description}
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Rechercher une adresse"
                size="small"
                sx={{
                  bgcolor: "white",
                  borderRadius: 1,
                  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.3)",
                  "& .MuiOutlinedInput-notchedOutline": { border: "none" },
                }}
              />
            )}
          />
        </Box>
      )}

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
