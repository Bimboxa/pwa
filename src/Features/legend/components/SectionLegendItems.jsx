import { Box } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import MarkerIcon from "Features/markers/components/MarkerIcon";

import getRowAndColFromIndex from "Features/markers/utils/getRowAndColFromIndex";

export default function SectionLegendItems({ legendItems }) {
  return (
    <BoxFlexVStretch>
      {legendItems?.map((item) => {
        const { row, col } = getRowAndColFromIndex(item.iconIndex);
        return (
          <Box key={item.iconIndex} sx={{ display: "flex", py: 0.5 }}>
            <Box
              sx={{
                bgcolor: item.iconColor,
                borderRadius: "50%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <MarkerIcon row={row} col={col} size={24} iconSize={64} />
            </Box>
          </Box>
        );
      })}
    </BoxFlexVStretch>
  );
}
