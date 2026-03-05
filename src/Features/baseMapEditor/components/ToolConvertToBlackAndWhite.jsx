import useCreateBaseMapVersion from "Features/baseMaps/hooks/useCreateBaseMapVersion";

import { ListItemButton, Typography } from "@mui/material";

import convertToBlackAndWhite from "Features/images/utils/convertToBlackAndWhite"

export default function ToolConvertToBlackAndWhite({ baseMap }) {

    // strings

    const label = "Noir et blanc";

    // data

    const createVersion = useCreateBaseMapVersion()

    // handlers

    async function handleClick() {
        const imageUrl = baseMap?.getUrl()
        const processedImageFile = await convertToBlackAndWhite(imageUrl)
        if (processedImageFile) await createVersion(baseMap?.id, processedImageFile, { label: "Noir et blanc" })
    }

    return <>

        <ListItemButton onClick={handleClick} divider>
            <Typography variant="body2">{label}</Typography>
        </ListItemButton>
    </>

}
