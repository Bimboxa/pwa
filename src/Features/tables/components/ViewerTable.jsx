import useListingMainTable from "../hooks/useListingMainTable";
import getDatagridColumnsFromTableConfig from "../utils/getDatagridColumnsFromTableConfig";

import {Box} from "@mui/material";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import DatagridTable from "./DatagridTable";

export default function ViewerTable() {
  // data

  const table = useListingMainTable();

  // helpers
  const datagridProps = table.datagridProps;

  return (
    <Box sx={{width: 1, height: 1, display: "flex", flexDirection: "column"}}>
      <BoxFlexVStretch>
        <DatagridTable {...datagridProps} />
      </BoxFlexVStretch>
    </Box>
  );
}
