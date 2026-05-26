import { Paper } from "@mui/material";

import SectionSearchAddress from "Features/leafletEditor/components/SectionSearchAddress";

export default function ToolbarSearchAddress({ onLatLongChange }) {
  return (
    <Paper>
      <SectionSearchAddress onLatLongChange={onLatLongChange} />
    </Paper>
  );
}
