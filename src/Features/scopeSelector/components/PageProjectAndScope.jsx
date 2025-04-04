import {useState} from "react";

import {useDispatch} from "react-redux";

import {setPage} from "../scopeSelectorSlice";

import useSelectedScope from "Features/scopes/hooks/useSelectedScope";

import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  ListItem,
  ListItemText,
  ListItemButton,
} from "@mui/material";
import {ArrowForwardIos as Forward, Edit} from "@mui/icons-material";

import BoxCenter from "Features/layout/components/BoxCenter";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import BarAppConfig from "Features/appConfig/components/BarAppConfig";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import DialogEditProject from "Features/projects/components/DialogEditProject";
import DialogEditScope from "Features/scopes/components/DialogEditScope";

export default function PageProjectAndScope() {
  const dispatch = useDispatch();
  const appConfig = useAppConfig();

  // strings

  const onClientS = "Sur cet appareil";
  const projectS = appConfig?.strings?.project?.nameSingular;
  const scopeS = appConfig?.strings?.scope?.nameSingular;
  const seeProjectsS = appConfig?.strings?.project?.seeAll;
  const seeScopesS = appConfig?.strings?.scope?.seeAll;
  const clientRefS = "Réf.";

  // data

  const {value: scope} = useSelectedScope({withProject: true});

  // state

  const [openProject, setOpenProject] = useState(false);
  const [openScope, setOpenScope] = useState(false);

  // helpers

  const projectName = scope?.project?.name;
  const scopeName = scope?.name ?? "-";

  const projectRefLabel = `${clientRefS} ${scope?.project?.clientRef}`;
  const scopeRefLabel = scope?.clientRef
    ? `${clientRefS} ${scope.clientRef}`
    : null;

  // handlers

  function handleSeeProjectsClick() {
    dispatch(setPage("PROJECTS"));
  }

  function handleSeeScopesClick() {
    dispatch(setPage("SCOPES"));
  }

  function handleProjectEditClick() {
    setOpenProject(true);
  }

  function handleScopeEditClick() {
    setOpenScope(true);
  }

  return (
    <>
      <DialogEditProject
        project={scope?.project}
        open={openProject}
        onClose={() => setOpenProject(false)}
      />
      <DialogEditScope
        scope={scope}
        open={openScope}
        onClose={() => setOpenScope(false)}
      />
      <BoxFlexVStretch>
        <BoxFlexVStretch
          sx={{borderBottom: (theme) => `1px solid ${theme.palette.divider}`}}
        >
          <Box sx={{px: 1}}>
            <Box
              sx={{
                width: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {projectS}
              </Typography>
              <IconButton size="small" onClick={handleProjectEditClick}>
                <Edit fontSize="small" />
              </IconButton>
            </Box>

            <Typography>{projectName}</Typography>
            <Typography variant="caption">{projectRefLabel}</Typography>
            {/* <Box sx={{display: "flex", width: 1, justifyContent: "flex-end"}}>
              <Button
                endIcon={<Forward />}
                color="inherit"
                onClick={handleSeeProjectsClick}
              >
                {seeProjectsS}
              </Button>
            </Box> */}
          </Box>

          <Box
            sx={{
              p: 2,
              borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
            }}
          >
            <Paper elevation={6}>
              <Box
                sx={{
                  borderRadius: 1,
                  bgcolor: "white",
                  p: 1,
                  width: 1,
                  borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
                }}
              >
                <Box
                  sx={{
                    width: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {scopeS}
                  </Typography>
                  <IconButton size="small" onClick={handleScopeEditClick}>
                    <Edit fontSize="small" />
                  </IconButton>
                </Box>
                <Typography>{scopeName}</Typography>
                <Typography variant="caption">{scopeRefLabel}</Typography>
                {/* <Box sx={{display: "flex", width: 1, justifyContent: "flex-end"}}>
                <Button endIcon={<Forward />} onClick={handleSeeScopesClick}>
                  {seeScopesS}
                </Button>
              </Box> */}
              </Box>
              <ListItem
                disablePadding
                secondaryAction={
                  <BoxCenter>
                    <Forward color="action" />
                  </BoxCenter>
                }
              >
                <ListItemButton
                  sx={{bgcolor: "white"}}
                  dense
                  color="inherit"
                  onClick={handleSeeScopesClick}
                >
                  <ListItemText>
                    <Typography variant="body2" color="text.secondary">
                      {seeScopesS}
                    </Typography>
                  </ListItemText>
                </ListItemButton>
              </ListItem>
            </Paper>
          </Box>
          <ListItem
            disablePadding
            secondaryAction={
              <BoxCenter>
                <Forward color="action" />
              </BoxCenter>
            }
          >
            <ListItemButton
              divider
              dense
              color="inherit"
              onClick={handleSeeProjectsClick}
            >
              <ListItemText>{seeProjectsS}</ListItemText>
            </ListItemButton>
          </ListItem>
        </BoxFlexVStretch>

        <BarAppConfig />
      </BoxFlexVStretch>
    </>
  );
}
