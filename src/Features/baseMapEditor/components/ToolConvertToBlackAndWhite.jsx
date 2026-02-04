import useUpdateBaseMapWithImageEnhanced from "Features/baseMaps/hooks/useUpdateBaseMapWithImageEnhanced";

import { ListItemButton, Typography } from "@mui/material";

import convertToBlackAndWhite from "Features/images/utils/convertToBlackAndWhite"

export default function ToolConvertToBlackAndWhite({ baseMap }) {

    // strings

    const label = "Noir et blanc";

    // data

    const update = useUpdateBaseMapWithImageEnhanced()

    // handlers

    async function handleClick() {
        const imageUrl = baseMap?.getUrl()
        const processedImageFile = await convertToBlackAndWhite(imageUrl)
        if (processedImageFile) await update(baseMap?.id, processedImageFile)
    }

    return <>

        <ListItemButton onClick={handleClick} divider>
            <Typography variant="body2">{label}</Typography>
        </ListItemButton>
    </>

}
