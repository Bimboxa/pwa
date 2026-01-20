import React from "react";
import SvgIcon from "@mui/material/SvgIcon";

const ExcelIcon = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Sheet-like shape */}
    <path
      d="M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"
      fill="white"
    />
    {/* Bold "X" */}
    <path
      d="M9 9h1.5l1.2 1.9 1.2-1.9H14l-1.8 2.8 1.8 2.8h-1.5l-1.2-1.9-1.2 1.9H9l1.8-2.8L9 9z"
      fill="#4CAF50"
    />
  </SvgIcon>
);

export default ExcelIcon;
