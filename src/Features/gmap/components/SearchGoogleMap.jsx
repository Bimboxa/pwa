import { useRef, useEffect, useState } from "react";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";

import getMapsApiAsync from "../services/getMapsApiAsync";

export default function SearchGoogleMap() {
  const [inputValue, setInputValue] = useState("");
  const [options, setOptions] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const autocompleteServiceRef = useRef(null);
  const placesServiceRef = useRef(null);
  const mapRef = useRef(null);

  // Load Google Maps script and initialize services
  useEffect(() => {
    initServicesAsync();
    async function initServicesAsync() {
      const mapsApi = await getMapsApiAsync();
      if (mapsApi) {
        autocompleteServiceRef.current =
          new mapsApi.places.AutocompleteService();
      }
    }
  }, []);

  // Fetch autocomplete suggestions
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
    autocompleteServiceRef.current.getPlacePredictions(
      { input: inputValue, types: ["address"] },
      (predictions) => {
        if (active) {
          setOptions(predictions || []);
        }
      }
    );
    return () => {
      active = false;
    };
  }, [inputValue]);

  return (
    <Box sx={{ width: 400, margin: "0 auto", mt: 4 }}>
      <Autocomplete
        freeSolo
        filterOptions={(x) => x}
        options={options}
        getOptionLabel={(option) =>
          typeof option === "string" ? option : option.description || ""
        }
        onInputChange={(_, value) => setInputValue(value)}
        onChange={(_, value) => setSelectedPlace(value)}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Search address"
            variant="outlined"
            fullWidth
          />
        )}
        renderOption={(props, option) => (
          <li {...props} key={option.place_id}>
            {option.description}
          </li>
        )}
      />
    </Box>
  );
}
