import { useSelector, useDispatch } from "react-redux";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import { Box, Tooltip, useTheme } from "@mui/material";
import { DesignServices as DetailIcon } from "@mui/icons-material";
import { grey } from "@mui/material/colors";
import { lighten } from "@mui/material/styles";

import { setOpenedPanel, setSelectedListingId } from "Features/listings/listingsSlice";

export default function IconButtonOpenBaseMapDetail() {
    const size = "32px";
    const dispatch = useDispatch();
    const theme = useTheme();

    // data
    const openedPanel = useSelector(s => s.listings.openedPanel);
    const baseMap = useMainBaseMap();

    const selected = openedPanel === "BASE_MAP_DETAIL";

    // Styles setup matching IconListingVariantSelectable
    const listingColor = theme.palette.secondary.main;
    const listingColorLight = lighten(listingColor, 0.2);
    // const listingColorLightest = lighten(listingColor, 0.5); // Not used in reference
    const _grey = grey[500];
    const _greyLight = lighten(_grey, 0.2);

    // Default State (Not selected)
    let bgcolor = null;
    let color = _grey;
    let border = `1px solid ${_grey}`;

    // Hover State (Not selected)
    let bgcolorHover = listingColorLight; // Reference uses listingColorLight
    let borderHover = "none";
    let colorHover = "white"; // Reference uses white

    // Selected State
    let bgcolorSelected = listingColor;
    let colorSelected = "white";
    let borderSelected = "none";

    // Hover State (Selected)
    let bgcolorHoverSelected = listingColorLight;
    let colorHoverSelected = "white";
    let borderHoverSelected = "none";


    // handlers
    function handleClick() {
        dispatch(setOpenedPanel("BASE_MAP_DETAIL"));
        dispatch(setSelectedListingId(baseMap?.listingId));
    }

    return (
        <Box sx={{ p: 0.75, display: "flex", justifyContent: "center" }}>
            <Tooltip title="Détails du fond de plan" placement="right">
                <Box
                    sx={{
                        borderRadius: 2,
                        bgcolor: selected ? bgcolorSelected : bgcolor,
                        color: selected ? colorSelected : color,
                        border: selected ? borderSelected : border,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",

                        "&:hover": {
                            bgcolor: selected ? bgcolorHoverSelected : bgcolorHover,
                            color: selected ? colorHoverSelected : colorHover,
                            border: selected ? borderHoverSelected : borderHover,
                        },
                        width: size,
                        height: size,
                        cursor: "pointer",
                        transition: "all 0.2s"
                    }}
                    onClick={handleClick}
                >
                    <DetailIcon sx={{ color: "inherit" }} />
                </Box>
            </Tooltip>
        </Box>
    );
}