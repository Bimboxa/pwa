import { forwardRef } from "react";

import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";

const EmptyContainerPlaceholder = forwardRef(function EmptyContainerPlaceholder(
  { width, height, onClick },
  ref
) {
  // render

  return (
    <g ref={ref} style={{ cursor: "pointer" }}>
      <rect
        x={4}
        y={4}
        width={width - 8}
        height={height - 8}
        fill="none"
        stroke="#ccc"
        strokeWidth={2}
        strokeDasharray="8 4"
      />
      <foreignObject x={0} y={0} width={width} height={height}>
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={onClick}
            sx={{
              textTransform: "none",
              borderStyle: "dashed",
              color: "text.secondary",
              borderColor: "divider",
              "&:hover": {
                borderStyle: "dashed",
                borderColor: "text.secondary",
                bgcolor: "action.hover",
              },
            }}
          >
            Ajouter un fond de plan
          </Button>
        </div>
      </foreignObject>
    </g>
  );
});

export default EmptyContainerPlaceholder;
