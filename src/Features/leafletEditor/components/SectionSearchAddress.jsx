import React, { useState, useEffect, useMemo } from "react";
import {
  Autocomplete,
  TextField,
  CircularProgress,
  Grid,
  Typography,
} from "@mui/material";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import { debounce } from "@mui/material/utils";

export default function SectionSearchAddress({ onLatLongChange }) {
  const [inputValue, setInputValue] = useState("");
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [value, setValue] = useState(null);

  // Création du fetch avec debounce pour ne pas surcharger l'API
  const fetchAddress = useMemo(
    () =>
      debounce((request, callback) => {
        fetch(
          `https://api-adresse.data.gouv.fr/search/?q=${request.input}&limit=5`
        )
          .then((response) => response.json())
          .then((data) => {
            // Transformation du GeoJSON en format utilisable par l'Autocomplete
            const formattedOptions = data.features?.map((feature) => ({
              label: feature.properties.label,
              city: feature.properties.city,
              postcode: feature.properties.postcode,
              // Attention: GeoJSON renvoie [Longitude, Latitude]
              coordinates: feature.geometry.coordinates,
            }));
            callback(formattedOptions);
          })
          .catch((err) => {
            console.error("Erreur API Adresse:", err);
            callback([]);
          });
      }, 400), // Délai de 400ms après la frappe
    []
  );

  useEffect(() => {
    let active = true;

    if (inputValue === "") {
      setOptions(value ? [value] : []);
      return undefined;
    }

    setLoading(true);

    fetchAddress({ input: inputValue }, (results) => {
      if (active) {
        let newOptions = [];
        if (value) {
          newOptions = [value];
        }
        if (results) {
          newOptions = [...newOptions, ...results];
        }
        setOptions(newOptions);
        setLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [value, inputValue, fetchAddress]);

  return (
    <Autocomplete
      id="address-search-france"
      size="small"
      sx={{ width: 350 }}
      getOptionLabel={(option) =>
        typeof option === "string" ? option : option.label
      }
      filterOptions={(x) => x} // On désactive le filtre local car l'API filtre déjà
      options={options}
      autoComplete
      includeInputInList
      filterSelectedOptions
      value={value}
      noOptionsText="Aucune adresse trouvée"
      loading={loading}
      loadingText="Chargement..."
      // Gestion du changement de texte (ce que l'utilisateur tape)
      onInputChange={(event, newInputValue) => {
        event.stopPropagation();
        setInputValue(newInputValue);
      }}
      // Gestion de la sélection finale
      onChange={(event, newValue) => {
        setOptions(newValue ? [newValue, ...options] : options);
        setValue(newValue);

        if (newValue && newValue.coordinates) {
          // L'API renvoie [Lon, Lat], on renvoie souvent {lat, lng} ou [lat, lng]
          // Ici je sépare bien les deux pour ton callback
          const [longitude, latitude] = newValue.coordinates;
          if (onLatLongChange) {
            onLatLongChange(latitude, longitude);
          }
        } else {
          // Si l'utilisateur efface la sélection
          if (onLatLongChange) {
            onLatLongChange(null, null);
          }
        }
      }}
      // Rendu de chaque option dans la liste déroulante
      renderOption={(props, option) => {
        const { key, ...optionProps } = props;
        return (
          <li key={key} {...optionProps}>
            <Grid container alignItems="center">
              <Grid item sx={{ display: "flex", width: 44 }}>
                <LocationOnIcon sx={{ color: "text.secondary" }} />
              </Grid>
              <Grid
                item
                sx={{ width: "calc(100% - 44px)", wordWrap: "break-word" }}
              >
                <Typography variant="body1" color="text.primary">
                  {option.label}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {option.postcode} {option.city}
                </Typography>
              </Grid>
            </Grid>
          </li>
        );
      }}
      // Rendu du champ texte principal
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder="Rechercher une adresse"
          //label="Rechercher une adresse"
          fullWidth
          onKeyDown={(event) => {
            event.stopPropagation();
          }}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <React.Fragment>
                {loading ? (
                  <CircularProgress color="inherit" size={20} />
                ) : null}
                {params.InputProps.endAdornment}
              </React.Fragment>
            ),
          }}
        />
      )}
    />
  );
}
