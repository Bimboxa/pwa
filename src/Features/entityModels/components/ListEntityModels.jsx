import { Box } from "@mui/material";

import BlockEntityModel from "./BlockEntityModel";

export default function ListEntityModels({
  models,
  searchQuery,
  selectedKey,
  onSelect,
}) {
  // helpers

  const query = searchQuery?.toLowerCase() ?? "";
  const filtered = models?.filter((model) => {
    if (!query) return true;
    return (
      model.key?.toLowerCase().includes(query) ||
      model.name?.toLowerCase().includes(query)
    );
  });

  // render

  return (
    <Box sx={{ overflow: "auto", flexGrow: 1 }}>
      {filtered?.map((model) => (
        <BlockEntityModel
          key={model.key}
          model={model}
          selected={selectedKey === model.key}
          onClick={() => onSelect(model.key)}
        />
      ))}
    </Box>
  );
}
