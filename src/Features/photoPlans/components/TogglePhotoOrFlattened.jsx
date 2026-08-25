import { useDispatch } from "react-redux";

import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import { ToggleButton, ToggleButtonGroup } from "@mui/material";

import useBaseMap from "Features/baseMaps/hooks/useBaseMap";

// "Photo d'origine / Mise à plat" quick switch shown in the baseMap
// properties when the baseMap belongs to a photo <-> flattened pair (the
// photo itself is hidden from the lists once flattened). Self-hiding.
export default function TogglePhotoOrFlattened({ baseMap }) {
  const dispatch = useDispatch();

  const isFlattened = Boolean(baseMap?.sourcePhotoBaseMapId);
  const counterpartId = isFlattened
    ? baseMap.sourcePhotoBaseMapId
    : baseMap?.flattenedBaseMapId;

  const counterpart = useBaseMap({ id: counterpartId ?? null });

  if (!counterpartId || !counterpart) return null;

  function handleChange(value) {
    const current = isFlattened ? "FLAT" : "PHOTO";
    if (!value || value === current) return;
    dispatch(setSelectedMainBaseMapId(counterpart.id));
    dispatch(
      setSelectedItem({
        id: counterpart.id,
        type: "BASE_MAP",
        listingId: counterpart.listingId,
      })
    );
  }

  return (
    <ToggleButtonGroup
      exclusive
      fullWidth
      size="small"
      value={isFlattened ? "FLAT" : "PHOTO"}
      onChange={(_e, v) => handleChange(v)}
    >
      <ToggleButton value="PHOTO" sx={{ textTransform: "none", py: 0.25 }}>
        Photo d&apos;origine
      </ToggleButton>
      <ToggleButton value="FLAT" sx={{ textTransform: "none", py: 0.25 }}>
        Mise à plat
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
