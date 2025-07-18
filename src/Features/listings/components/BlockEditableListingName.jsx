import { useEffect, useState } from "react";

import { Box, InputBase } from "@mui/material";

export default function BlockEditableListingName({
  name,
  onChange,
  label,
  color,
}) {
  // state

  const [tempName, setTempName] = useState("");
  useEffect(() => {
    setTempName(name);
  }, [name]);

  return (
    <Box sx={{ bgcolor: color, borderRadius: "16px" }}>
      <InputBase
        placeholder={label}
        value={tempName}
        onChange={(e) => setTempName(e.target.value)}
        onBlur={() => onChange(tempName)}
        sx={{ color: "white", px: 2 }}
      />
    </Box>
  );
}
