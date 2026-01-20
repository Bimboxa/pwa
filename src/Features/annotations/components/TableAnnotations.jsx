import { useSelector } from "react-redux";

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import { Box, Typography } from "@mui/material";

import DatagridAnnotations from "./DatagridAnnotations";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import IconListingVariantBasic from "Features/listings/components/IconListingVariantBasic";
import TableAnnotationsToolbar from "./TableAnnotationsToolbar";

export default function TableAnnotations() {

    // data

    const { value: listing } = useSelectedListing();
    const listingId = listing?.id;
    const annotations = useAnnotationsV2({
        filterByListingId: listingId,
        excludeBgAnnotations: true,
        withQties: true,
    });



    const selectedNodes = useSelector(s => s.mapEditor.selectedNodes);

    // helpers

    const selectedAnnotationIds = selectedNodes?.filter(n => n.nodeType === "ANNOTATION").map(n => n.nodeId);

    console.log("debug_selectedAnnotationIds", selectedAnnotationIds);

    // handlers

    function handleSelectionChange(selection) {
        console.log("selection", selection);
    }

    // render

    return <BoxFlexVStretch>
        <Box sx={{ display: "flex", alignItems: "center", p: 2 }}>
            <IconListingVariantBasic listing={listing} />
            <Typography sx={{ ml: 1, fontWeight: "bold" }}>
                {listing?.name}
            </Typography>
        </Box>
        <TableAnnotationsToolbar annotations={annotations} />

        <BoxFlexVStretch>
            <DatagridAnnotations annotations={annotations} onSelectionChange={handleSelectionChange} selectedIds={selectedAnnotationIds} />
        </BoxFlexVStretch>
    </BoxFlexVStretch>;
}