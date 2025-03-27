import {Box, Typography} from "@mui/material";

import FieldOptionSelector from "Features/form/components/FieldOptionSelector";

export default function BlockEntityPropsActions({listing, props, onChange}) {
  // strings

  const noActions = "Aucune action disponible";

  // helpers

  const actionsTemplate = listing?.entityModel?.actionsTemplate;
  const type = actionsTemplate?.type;

  // handlers

  function handleOptionChange(option) {
    if (type === "SELECT_OPTIONS") {
      const optionKey = actionsTemplate?.optionKey;
      const newEntityProps = {...props, [optionKey]: option};
      onChange(newEntityProps);
    }
  }

  const componentsByType = {
    SELECT_OPTIONS: (
      <FieldOptionSelector
        value={props?.[actionsTemplate?.optionKey]?.value}
        onChange={handleOptionChange}
        options={listing?.options}
      />
    ),
  };

  const component = componentsByType[type] ?? (
    <Box>
      <Typography>{noActions}</Typography>
    </Box>
  );

  return component;
}
