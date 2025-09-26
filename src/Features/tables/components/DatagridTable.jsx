import { DataGridPro } from "@mui/x-data-grid-pro";

export default function DatagridTable(props) {
  // debug

  if (props?.treeData && !props.getTreeDataPath)
    props.getTreeDataPath = (row) => row.path;

  return (
    <DataGridPro
      {...props}
      density="compact"
      sx={{
        "& .MuiDataGrid-cell": {
          whiteSpace: "pre-line !important",
          wordBreak: "break-word",
          lineHeight: "auto",
        },
      }}
    />
  );
}
