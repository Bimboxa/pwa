import {Box, Paper, Typography} from "@mui/material";
import useSelectedEntity from "Features/entities/hooks/useSelectedEntity";
import FieldOptionSelector from "Features/form/components/FieldOptionSelector";
import BottomBarCancelSave from "Features/layout/components/BottomBarCancelSave";
import SwitchMultiSelect from "./SwitchMultiSelect";
import SectionActionsEntityProps from "./SectionActionsEntityProps";
import {useSelector} from "react-redux";

export default function BlockBottomActionsInPanel() {
  const selection = useSelector((s) => s.entityProps.selection);
  const multiSelect = useSelector((s) => s.entityProps.multiSelect);

  const countLabel = `(x${selection.length})`;

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
      <Box sx={{display: "flex", alignItems: "center"}}>
        <SwitchMultiSelect />
        {multiSelect && <Typography variant="caption">{countLabel}</Typography>}
      </Box>
    </Paper>
  );
}
