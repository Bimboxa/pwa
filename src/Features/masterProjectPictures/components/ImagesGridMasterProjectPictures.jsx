import useMasterProjectPictures from "../hooks/useMasterProjectPictures";

import { Box, Typography } from "@mui/material";
import GridImagesClickable from "Features/images/components/GridImagesClickable";

export default function ImagesGridMasterProjectPictures() {

    // data

    const imagesByDate = useMasterProjectPictures({ groupByDate: true })


    // render

    return (
        <Box sx={{ width: 1 }}>
            {imagesByDate.map((imagesGroup, index) => {
                const label = imagesGroup.label;
                const images = imagesGroup.items.map(image => {
                    return {
                        ...image,
                        url: image.urlThumbnail,
                    }
                });
                return (
                    <Box key={index}>
                        <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>{label}</Typography>
                        <GridImagesClickable
                            images={images}
                            columns={2}
                        />
                    </Box>
                )
            })}
        </Box>

    )



}