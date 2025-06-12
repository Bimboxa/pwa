import {useDispatch} from "react-redux";

import {setOpenPanelListItem} from "Features/listPanel/listPanelSlice";
import {setTempMarker} from "../markersSlice";

import useEntity from "Features/entities/hooks/useEntity";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useCreateMarker from "Features/markers/hooks/useCreateMarker";
import {Box, Typography, Button} from "@mui/material";
import DraggableFabMarker from "Features/markers/components/DraggableFabMarker";

import theme from "Styles/theme";
import {lighten} from "@mui/material";
import getDateString from "Features/misc/utils/getDateString";

export default function BlockEntityMarker({top, right}) {
  const dispatch = useDispatch();

  // data

  const entity = useEntity();
  const {value: listing} = useSelectedListing({withEntityModel: true});

  // data - func

  const createMarker = useCreateMarker();

  // helper

  const show = listing?.entityModel?.type === "LOCATED_ENTITY";
  const newS = listing?.entityModel?.strings?.labelNew;
  //entity?.id &&
  //entity?.listingId === listing.id;

  // helpers

  const color = listing?.color ?? theme.palette.primary.main;
  const label = entity?.id ? entity?.label : newS;

  // handlers

  function handleCreateMarker({x, y, mapId}) {
    console.log("[handleCreateMarker] entity", entity);
    if (entity.id) {
      createMarker({
        mapId,
        x,
        y,
        listingId: listing?.id,
        entityId: entity.id,
      });
    } else {
      dispatch(
        setTempMarker({
          isTemp: true,
          x,
          y,
          mapId,
          createdAt: getDateString(new Date()),
        })
      );
      dispatch(setOpenPanelListItem(true));
    }
  }

  function handleEntityClick() {
    dispatch(setOpenPanelListItem(true));
  }

  return (
    <Box
      sx={{
        display: show ? "flex" : "none",
        alignItems: "center",
        position: "fixed",
        top: `${top}px`,
        right: `${right + 30}px`,
        zIndex: 2,
      }}
    >
      <Box sx={{position: "relative", display: "flex", alignItems: "center"}}>
        <Button
          onClick={handleEntityClick}
          sx={{
            bgcolor: lighten(color, 0.15),
            color: "common.white",
            borderRadius: 1,
            p: 0.5,
            pl: 1,
            display: "flex",
            alignItems: "center",
          }}
        >
          <Typography variant="caption" sx={{mr: 2}}>
            {label}
          </Typography>
        </Button>
        <Box
          sx={{
            position: "absolute",
            right: 0,
            top: "50%",
            transform: "translate(70%, -50%)",
          }}
        >
          <DraggableFabMarker bgcolor={color} onDropped={handleCreateMarker} />
        </Box>
      </Box>
    </Box>
  );
}
