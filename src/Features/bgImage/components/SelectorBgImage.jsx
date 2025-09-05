import { useState, useEffect, useRef } from "react";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Box } from "@mui/material";

import GridImagesClickable from "Features/images/components/GridImagesClickable";

import ImageObject from "Features/images/js/ImageObject";

export default function SelectorBgImage({ selectedKey, onChange }) {
  const ref = useRef();

  // data

  const appConfig = useAppConfig();

  // state

  const [containerWidth, setContainerWidth] = useState(0);

  // effect

  useEffect(() => {
    if (ref.current) {
      setContainerWidth(ref.current.getBoundingClientRect().width);
    }
  }, [ref.current]);

  // helpers

  const options = appConfig?.features.bgImages.options;
  const images = options?.map(({ url, width, height }) => {
    return new ImageObject({ url, imageSize: { width, height } });
  });

  const selectedUrl = options?.find(
    (option) => option.key === selectedKey
  )?.url;

  // handlers

  function handleClick(image) {
    const option = options.find((option) => option.url === image.url);
    onChange(option?.key);
  }

  // return

  return (
    <Box ref={ref} sx={{ width: 1 }}>
      <GridImagesClickable
        images={images}
        selectedUrl={selectedUrl}
        onClick={handleClick}
        containerWidth={containerWidth}
        columns={2}
      />
    </Box>
  );
}
