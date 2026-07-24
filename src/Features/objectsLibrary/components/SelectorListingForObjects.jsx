import { useMemo } from "react";

import {
  Box,
  Typography,
  TextField,
  Autocomplete,
  createFilterOptions,
} from "@mui/material";
import { Add } from "@mui/icons-material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import useCreateListingForObjects from "../hooks/useCreateListingForObjects";
import useObjectsTargetListings from "../hooks/useObjectsTargetListings";

const filter = createFilterOptions();

const DEFAULT_SELECT_LISTING_TEXT =
  "Choisissez une liste où sera enregistré la figure";

// Bottom "Sélectionnez une liste…" picker: a searchable, creatable MUI
// Autocomplete over the MAP listing set (scoped LOCATED_ENTITY listings,
// excluding baseMap ones). Typing a name that doesn't exist offers
// "Créer la liste « … »"; the created list is selected as the target.
export default function SelectorListingForObjects({ value, onChange }) {
  const appConfig = useAppConfig();
  const listings = useObjectsTargetListings();
  const createListing = useCreateListingForObjects();

  const selectListingText =
    appConfig?.strings?.objectsLibrary?.selectListing ??
    DEFAULT_SELECT_LISTING_TEXT;

  const options = listings ?? [];
  const selectedListing = useMemo(
    () => options.find((l) => l.id === value) ?? null,
    [options, value]
  );

  // handlers

  async function handleChange(event, newValue) {
    if (!newValue) {
      onChange(null);
      return;
    }
    // freeSolo: Enter on raw text
    if (typeof newValue === "string") {
      const created = await createListing(newValue);
      if (created) onChange(created.id);
      return;
    }
    // "Créer la liste …" option
    if (newValue.__create) {
      const created = await createListing(newValue.inputValue);
      if (created) onChange(created.id);
      return;
    }
    onChange(newValue.id);
  }

  // render

  return (
    <Box>
      <Typography variant="body2" sx={{ mb: 1 }}>
        {selectListingText}
      </Typography>
      <Autocomplete
        value={selectedListing}
        onChange={handleChange}
        options={options}
        getOptionLabel={(option) =>
          typeof option === "string" ? option : (option?.name ?? "")
        }
        isOptionEqualToValue={(option, val) => option?.id === val?.id}
        selectOnFocus
        clearOnBlur
        handleHomeEndKeys
        noOptionsText="Aucune liste ne correspond"
        filterOptions={(opts, params) => {
          const filtered = filter(opts, params);
          const query = params.inputValue.trim();
          // Always offer a create affordance (named when a query is typed).
          filtered.push({
            __create: true,
            inputValue: query,
            name: query ? `Créer la liste « ${query} »` : "Créer une liste",
          });
          return filtered;
        }}
        renderOption={(props, option) => {
          const { key, ...optionProps } = props;
          return (
            <Box
              component="li"
              key={key}
              {...optionProps}
              sx={
                option.__create
                  ? { borderTop: (t) => `1px solid ${t.palette.divider}` }
                  : undefined
              }
            >
              {option.__create ? (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    color: "primary.main",
                    fontWeight: 600,
                  }}
                >
                  <Add fontSize="small" />
                  {option.name}
                </Box>
              ) : (
                option.name
              )}
            </Box>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            size="small"
            placeholder="Sélectionnez une liste…"
          />
        )}
      />
    </Box>
  );
}
