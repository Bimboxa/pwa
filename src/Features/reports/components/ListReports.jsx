import {List} from "@mui/material";

import ListItemButtonReport from "./ListItemButtonReport";

export default function ListReports({reports}) {
  return (
    <List>
      {reports?.map((report) => (
        <ListItemButtonReport key={report.id} report={report} />
      ))}
    </List>
  );
}
