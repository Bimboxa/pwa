import {Box, Paper, Typography} from "@mui/material";
import useSelectedEntity from "Features/entities/hooks/useSelectedEntity";
import FieldOptionSelector from "Features/form/components/FieldOptionSelector";
import BottomBarCancelSave from "Features/layout/components/BottomBarCancelSave";
import SwitchMultiSelect from "./SwitchMultiSelect";
import SectionActionsEntityProps from "./SectionActionsEntityProps";
import {useSelector} from "react-redux";
import BlockSaveMultiChanges from "./BlockSaveMultiChanges";

export default function BlockBottomActionsInPanel() {
  // data

  const multiSelect = useSelector((s) => s.entityProps.multiSelect);
  const tempPropsObject = useSelector((s) => s.entityProps.tempPropsObject);

  // helpers

  const showButtons = multiSelect && tempPropsObject;

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
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          mt: 1,
          justifyContent: "space-between",
        }}
      >
        <SwitchMultiSelect />
        <Box sx={{visibility: showButtons ? "visible" : "hidden"}}>
          <BlockSaveMultiChanges />
        </Box>
      </Box>
    </Paper>
  );
}
