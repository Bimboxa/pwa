import { useEffect, useMemo, useState } from "react";

import {
  Box,
  Button,
  CircularProgress,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";

const MIN_QUERY_LENGTH = 3;
const SEARCH_DELAY_MS = 350;
const SEARCH_URL = "https://api-adresse.data.gouv.fr/search/";

export default function SectionSearchAddress({ onLatLongChange }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);

  const selectedResult = useMemo(() => {
    if (
      selectedIndex === null ||
      selectedIndex < 0 ||
      selectedIndex >= results.length
    ) {
      return null;
    }
    return results[selectedIndex];
  }, [results, selectedIndex]);

  useEffect(() => {
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setSelectedIndex(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          q: `${query} France`,
          limit: "5",
        });

        const response = await fetch(`${SEARCH_URL}?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("La recherche d'adresse a échoué.");
        }
        const data = await response.json();
        const features = data?.features ?? [];
        setResults(
          features.map((feature) => {
            const { coordinates } = feature?.geometry ?? {};
            return {
              id: feature?.properties?.id ?? feature?.properties?.label,
              label: feature?.properties?.label,
              street: feature?.properties?.name,
              city: feature?.properties?.city,
              postalCode: feature?.properties?.postcode,
              coordinates,
            };
          })
        );
        setSelectedIndex(features.length ? 0 : null);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Failed to search address:", err);
          setError(err.message ?? "Erreur inattendue");
        }
      } finally {
        setLoading(false);
      }
    }, SEARCH_DELAY_MS);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query]);

  function handleValidate() {
    if (!selectedResult || typeof onLatLongChange !== "function") return;
    const [lon, lat] = selectedResult.coordinates ?? [];
    if (
      typeof lat !== "number" ||
      Number.isNaN(lat) ||
      typeof lon !== "number" ||
      Number.isNaN(lon)
    ) {
      return;
    }
    onLatLongChange({ lat, lon, label: selectedResult.label });
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <TextField
        label="Rechercher une adresse (France)"
        size="small"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Ex: 10 rue de la Paix, Paris"
      />

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
          <CircularProgress size={20} />
        </Box>
      )}

      {!!error && (
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      )}

      {!loading && !error && query.trim().length >= MIN_QUERY_LENGTH && (
        <>
          {results.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Aucune adresse trouvée. Essayez d'affiner votre recherche.
            </Typography>
          ) : (
            <List dense sx={{ maxHeight: 200, overflowY: "auto" }}>
              {results.map((result, index) => (
                <ListItemButton
                  key={result.id ?? index}
                  selected={index === selectedIndex}
                  onClick={() => setSelectedIndex(index)}
                >
                  <ListItemText
                    primary={result.label}
                    secondary={
                      result.city
                        ? `${result.postalCode ?? ""} ${result.city}`
                        : undefined
                    }
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </>
      )}

      <Button
        variant="contained"
        onClick={handleValidate}
        disabled={!selectedResult}
      >
        Valider
      </Button>
    </Box>
  );
}
