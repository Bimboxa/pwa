import {Box, Typography} from "@mui/material";

import FieldOptionSelector from "Features/form/components/FieldOptionSelector";

export default function BlockEntityPropsActions({
  listing,
  propsObject, // {props, changedKeys,delete,multiSelect}
  onChange,
}) {
  // strings

  const noActions = "Aucune action disponible";

  // helpers

  const props = propsObject?.props ?? {};
  const selectionCount = propsObject?.selectionCount;

  const actionsTemplate = listing?.entityModel?.actionsTemplate;
  const type = actionsTemplate?.type;

  // handlers

  function handleOptionChange(option) {
    // edge case: delete option
    if (option.id === "delete") {
      onChange({delete: true});
      return;
    }
    // main
    if (type === "SELECT_OPTIONS") {
      const optionKey = actionsTemplate?.optionKey;
      const newEntityProps = {
        ...props,
        [optionKey]: {value: option, type: "option"},
      };
      onChange({changedKeys: [optionKey], props: newEntityProps});
    }
  }

  const componentsByType = {
    SELECT_OPTIONS: () => {
      const deleteOption = {id: "delete", label: "Supprimer"};
      const optionKey = actionsTemplate?.optionKey;
      const option = propsObject?.delete
        ? deleteOption
        : props?.[optionKey]?.value;
      let options = listing?.options;
      if (option) options = [deleteOption, ...options];
      return (
        <FieldOptionSelector
          value={option}
          onChange={handleOptionChange}
          options={options}
        />
      );
    },
  };

  const component = componentsByType[type] ? (
    componentsByType[type]()
  ) : (
    <Box>
      <Typography>{noActions}</Typography>
    </Box>
  );

  return component;
}
