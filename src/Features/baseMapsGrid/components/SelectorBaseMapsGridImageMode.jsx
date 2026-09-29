import { useDispatch, useSelector } from "react-redux";

import { setBaseMapsGridImageMode } from "../baseMapsGridSlice";

import { Box, IconButton, Paper, Tooltip } from "@mui/material";
import {
  HideImageOutlined,
  Image as ImageIcon,
  ImageOutlined,
} from "@mui/icons-material";

import { BASE_MAPS_GRID_IMAGE_MODE } from "../constants/baseMapsGridConstants";

// How the base map images show on the sheets of the grid: hidden
// (annotations only), faded (light grey, the annotations stand out) or as is.
export default function SelectorBaseMapsGridImageMode() {
  const dispatch = useDispatch();

  // strings

  const options = [
    {
      key: BASE_MAPS_GRID_IMAGE_MODE.NONE,
      label: "Sans image",
      icon: <HideImageOutlined fontSize="small" />,
    },
    {
      key: BASE_MAPS_GRID_IMAGE_MODE.FADED,
      label: "Image en gris clair",
      icon: <ImageOutlined fontSize="small" />,
    },
    {
      key: BASE_MAPS_GRID_IMAGE_MODE.FULL,
      label: "Image",
      icon: <ImageIcon fontSize="small" />,
    },
  ];

  // data

  const imageMode = useSelector((s) => s.baseMapsGrid.imageMode);

  // render

  return (
    <Paper
      elevation={3}
      sx={{ borderRadius: "10px", display: "flex", overflow: "hidden" }}
    >
      {options.map((option) => {
        const selected = option.key === imageMode;
        return (
          <Tooltip key={option.key} title={option.label}>
            <Box
              sx={{
                display: "flex",
                ...(selected && {
                  bgcolor: "grey.900",
                  color: "common.white",
                }),
              }}
            >
              <IconButton
                size="small"
                color="inherit"
                onClick={() => dispatch(setBaseMapsGridImageMode(option.key))}
              >
                {option.icon}
              </IconButton>
            </Box>
          </Tooltip>
        );
      })}
    </Paper>
  );
}
