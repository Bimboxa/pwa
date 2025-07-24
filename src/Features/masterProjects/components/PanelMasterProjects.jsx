import { useState } from "react";

import useMasterProjects from "../hooks/useMasterProjects";

import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

import { setSelectedProjectId } from "Features/projects/projectsSlice";
import { setSelectedMasterProjectId } from "../masterProjectsSlice";

import { Typography, Box } from "@mui/material";

import PanelVariantMap from "Features/layout/components/PanelVariantMap";
import ItemsList from "Features/itemsList/components/ItemsList";
import ListMasterProjects from "./ListMasterProjects";
import SectionCreateMasterProject from "./SectionCreateMasterProject";
import useInitFetchMasterProjects from "../hooks/useInitFetchMasterProjects";
import SectionListItems from "Features/itemsList/components/SectionListItems";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import { fetchMasterProjectPhotosService } from "../services/masterProjectsServices";

export default function PanelMasterProjects({ gmap, gmapContainer }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // strings

  const title = "Chantiers";

  // init

  useInitFetchMasterProjects();

  // data

  const masterProjects = useMasterProjects();

  // state

  const [imgUrl, setImgUrl] = useState(null);

  // helpers

  const items = masterProjects.map((p) => ({
    ...p,
    primaryText: p.name,
    secondaryText: p.clientRef + " " + p?.address?.city,
  }));

  // handlers

  async function handleClick(project) {
    dispatch(setSelectedProjectId(project.id));
    dispatch(setSelectedMasterProjectId(project.id));
    //navigate("/");
    console.log("click on project", project);
    //
    const photos = await fetchMasterProjectPhotosService({ id: project.id });
    console.log("photos", photos);
    const photo0 = photos?.[0];
    setImgUrl(photo0?.UrlThumbnail);
  }

  // render

  return (
    <PanelVariantMap>
      <Typography sx={{ p: 2 }} variant="h4">
        {title}
      </Typography>
      <BoxFlexVStretch>
        <ItemsList
          items={items}
          onClick={handleClick}
          maxItems={15}
          disableCreation={true}
          searchKeys={["name", "clientRef"]}
        />
      </BoxFlexVStretch>

      <SectionCreateMasterProject gmap={gmap} gmapContainer={gmapContainer} />
      {imgUrl && <img height={40} width={40} src={imgUrl} />}
    </PanelVariantMap>
  );
}
