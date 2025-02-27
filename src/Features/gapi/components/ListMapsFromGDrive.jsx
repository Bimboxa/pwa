import {useEffect, useState} from "react";
import {useSelector} from "react-redux";

import {Box, Typography} from "@mui/material";

import ListMaps from "Features/maps/components/ListMaps";

import {getFile, getMapsFolderService, listFiles} from "../gapiServicesFiles";
import getImageSizeAsync from "Features/maps/utils/getImageSizeAsync";

export default function ListMapsFromGDrive({onClick}) {
  // strings

  const title = "Fonds de plans";

  // data

  const bimboxFolderId = useSelector((s) => s.gapi.bimboxFolderId);

  // state

  const [files, setFiles] = useState([]);

  // effect

  useEffect(() => {
    const getFolderAsync = async (id) => {
      const folder = await getMapsFolderService(id);
      const files = await listFiles(folder.id);
      setFiles(files);
    };

    if (bimboxFolderId) getFolderAsync(bimboxFolderId);
  }, [bimboxFolderId]);

  // helpers

  const maps = files.map((file) => {
    return {
      id: file.id,
      name: file.name,
      imageUrl: file.webContentLink,
      //imageUrl: file.webViewLink,
      type: file.mimeType,
      thumbnail: file.thumbnailLink,
    };
  });

  // handler

  async function handleClick(map) {
    try {
      const file = await getFile(map.id);
      console.log("file", file);
      const imageUrl = URL.createObjectURL(file);
      const imageSize = await getImageSizeAsync(imageUrl);
      console.log("imageSize", imageSize);
      onClick({
        ...map,
        imageUrl,
        imageWidth: imageSize.width,
        imageHeight: imageSize.height,
        meterByPx: 0.01,
      });
    } catch (e) {
      console.log(e);
    }
  }

  return (
    <Box>
      <ListMaps maps={maps} onClick={handleClick} />
    </Box>
  );
}
