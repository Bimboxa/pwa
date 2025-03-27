import {Box, Paper} from "@mui/material";
import useSelectedEntity from "Features/entities/hooks/useSelectedEntity";
import FieldOptionSelector from "Features/form/components/FieldOptionSelector";
import BottomBarCancelSave from "Features/layout/components/BottomBarCancelSave";
import SwitchMultiSelect from "./SwitchMultiSelect";
import SectionActionsEntityProps from "./SectionActionsEntityProps";

export default function BlockBottomActionsInPanel() {
  const actions = [
    {
      type: "options",
      options: [
        {id: 1, label: "commande 1", color: "red"},
        {id: 2, label: "commande 2", color: "blue"},
      ],
    },
  ];

  // helpers

  const option = {id: 1, label: "command1"};
  const options = actions[0].options;

  // handlers

  function handleOptionChange(option) {
    console.log(option);
  }

  function handleSave() {}

  function handleCancel() {}

  return (
    <Paper elevation={6} sx={{width: 1, p: 1}}>
      {/* <BottomBarCancelSave>
        <FieldOptionSelector
          value={option}
          onChange={handleOptionChange}
          options={options}
        />
      </BottomBarCancelSave> */}

      <SectionActionsEntityProps />
      <SwitchMultiSelect />
    </Paper>
  );
}
