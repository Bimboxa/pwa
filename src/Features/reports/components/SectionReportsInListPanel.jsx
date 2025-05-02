import useReports from "../hooks/useReports";

import {Box} from "@mui/material";
import ListReports from "./ListReports";

export default function SectionReportsInListPanel() {
  // data

  const reports = useReports();

  return (
    <Box sx={{width: 1, bgcolor: "white"}}>
      <ListReports reports={reports} />
    </Box>
  );
}
