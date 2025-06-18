import {DataGridPro} from "@mui/x-data-grid-pro";

export default function DatagridTable(props) {
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
