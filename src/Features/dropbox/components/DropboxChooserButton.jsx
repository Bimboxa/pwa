import useRemoteContainer from "Features/sync/hooks/useRemoteContainer";
import {useEffect, useRef, useState} from "react";

import {Box} from "@mui/material";

function DropboxChooserButton(onSelectedFiles) {
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const dropboxButtonRef = useRef(null);

  const remoteContainer = useRemoteContainer();
  const clientId = remoteContainer?.clientId;

  useEffect(() => {
    if (!clientId) return;

    // Check if SDK already loaded
    if (window.Dropbox) {
      setSdkLoaded(true);
      return;
    }

    // Dynamically create script
    const script = document.createElement("script");
    script.src = "https://www.dropbox.com/static/api/2/dropins.js";
    script.id = "dropboxjs";
    script.type = "text/javascript";
    script.dataset.appKey = clientId;

    script.onload = () => {
      setSdkLoaded(true);
    };

    script.onerror = () => {
      console.error("Failed to load Dropbox SDK.");
    };

    document.body.appendChild(script);
  }, [clientId]);

  const openChooserManually = () => {
    if (!window.Dropbox) return;
    const options = {
      success: (files) => {
        console.log("Files selected:", files);
      },
      cancel: () => {
        console.log("User canceled.");
      },
      linkType: "preview", // "direct" or "preview"
      multiselect: true,
      extensions: [".pdf", ".jpg", ".png", ".docx"],
    };
    window.Dropbox.choose(options);
  };

  useEffect(() => {
    if (sdkLoaded && dropboxButtonRef.current && window.Dropbox) {
      const buttonElement = window.Dropbox.createChooseButton({
        success: (files) => {
          //console.log("Files selected from button:", files);
          if (onSelectedFiles) onSelectedFiles(files);
        },
        cancel: () => {
          console.log("User canceled from button.");
        },
        linkType: "preview",
        multiselect: true,
        extensions: [".pdf", ".jpg", ".png", ".docx"],
      });

      // Append the buttonElement directly
      dropboxButtonRef.current.appendChild(buttonElement);
    }
  }, [sdkLoaded]);

  return (
    <Box sx={{p: 1, width: 1, display: "flex", justifyContent: "center"}}>
      {/* 2. Official Dropbox button */}
      <div ref={dropboxButtonRef} style={{marginTop: "20px"}}></div>
    </Box>
  );
}

export default DropboxChooserButton;
