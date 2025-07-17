import { useEffect, useState } from "react";

import { Box, InputBase } from "@mui/material";

export default function BlockEditableListingName({ name, onChange, label }) {
  // state

  const [tempName, setTempName] = useState("");
  useEffect(() => {
    setTempName(name);
  }, [name]);

  return (
    <Box sx={{ bgcolor: "red", borderRadius: "16px" }}>
      <InputBase
        placeholder={label}
        value={tempName}
        onChange={(e) => setTempName(e.target.value)}
        sx={{ color: "white", px: 2 }}
      />
    </Box>
  );
}
