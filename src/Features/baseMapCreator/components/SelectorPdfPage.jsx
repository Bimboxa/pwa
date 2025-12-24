import { Box, ListItemButton, List, Skeleton } from "@mui/material"
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch"

export default function SelectorPdfPage({ pageNumber, thumbnails, onPageNumberChange }) {
    return <BoxFlexVStretch sx={{
        display: "flex",
        gap: 1,
        flexDirection: "column",
        alignItems: "center",
        minWidth: 0,
        width: 1,
    }}>
        <List sx={{
            width: 1

        }}>
            {thumbnails.map(({ imageUrl, status }, index) => {
                const selected = pageNumber === index + 1;
                const pending = status === "pending";
                return <ListItemButton selected={selected} key={index} onClick={() => onPageNumberChange(index + 1)}>
                    {pending ? <Skeleton variant="rectangular" width={"100%"} height={"80px"} /> : <img
                        width={"100%"}
                        src={imageUrl}
                        alt={`Page ${index + 1}`}
                    />}
                </ListItemButton>
            })}
        </List>
    </BoxFlexVStretch>
}