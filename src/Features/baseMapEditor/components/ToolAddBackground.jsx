import useUpdateBaseMapWithImageEnhanced from "Features/baseMaps/hooks/useUpdateBaseMapWithImageEnhanced";

import { ListItemButton, Typography } from "@mui/material";

import addBackgroundToImage from "Features/images/utils/addBackgroundToImage"

export default function ToolAddBackground({ baseMap, color = "#FFFFFF" }) {

    // strings

    const cropS = "Ajouter un fond blanc";

    // data

    const update = useUpdateBaseMapWithImageEnhanced()

    // handlers

    async function handleClick() {
        const imageUrl = baseMap?.getUrl()
        const processedImageFile = await addBackgroundToImage(imageUrl, color)
        if (processedImageFile) await update(baseMap?.id, processedImageFile)
    }

    return <>

        <ListItemButton onClick={handleClick} divider>
            <Typography variant="body2">{cropS}</Typography>
        </ListItemButton>
    </>

}
