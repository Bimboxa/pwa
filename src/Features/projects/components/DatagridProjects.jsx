import { useState } from "react";

import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

import { setSelectedProjectId } from "Features/projects/projectsSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { DataGridPro, GridActionsCellItem } from "@mui/x-data-grid-pro";

import { Box } from "@mui/material";
import { Delete } from "@mui/icons-material";

import DialogDeleteProject from "./DialogDeleteProject";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

export default function DatagridProjects({ projects }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // data

  const appConfig = useAppConfig();

  // helpers

  const projectName = appConfig?.strings?.project?.nameSingular;
  const projectClientRef = appConfig?.strings?.project?.clientRef;

  // state

  const [deleteProjectId, setDeleteProjectId] = useState(null);
  const openDelete = Boolean(deleteProjectId);

  // handlers

  function handleOpenProject({ projectId }) {
    dispatch(setSelectedProjectId(projectId));
    navigate(`/`);
  }

  // columns

  const columns = [
    { field: "projectName", headerName: projectName, flex: 1 },
    { field: "projectClientRef", headerName: "Réf.", flex: 1 },

    //{ field: "projectProjectClientRef", headerName: "Réf. projet", flex: 1 },
    {
      field: "openProject",
      headerName: "",
      width: 100,
      type: "actions",
      getActions: (params) => [
        <ButtonGeneric
          variant="contained"
          size="small"
          label="Ouvrir"
          onClick={() =>
            handleOpenProject({
              projectId: params.row.id,
            })
          }
        />,
      ],
    },
    {
      field: "actions",
      type: "actions",
      width: 80,
      getActions: (params) => {
        return [
          <GridActionsCellItem
            icon={<Delete />}
            label="Delete"
            onClick={() => setDeleteProjectId(params.id)}
          />,
        ];
      },
    },
  ];

  // rows

  const rows = projects?.map((project) => ({
    ...project,
    projectName: project.name,
    projectClientRef: project.clientRef,
  }));

  // return

  return (
    <>
      <Box
        sx={{
          width: 1,
          height: 1,
        }}
      >
        <DataGridPro
          columns={columns}
          rows={rows ?? []}
          hideFooter
          density="compact"
          onRowClick={(params) => {
            // Don't trigger if clicking on actions column
            if (params.field !== "actions" && params.field !== "openProject") {
              handleOpenProject({ projectId: params.id });
            }
          }}
          sx={{
            backgroundColor: "white",
            "& .MuiDataGrid-columnHeaders": {
              backgroundColor: "white !important",
            },
            "& .MuiDataGrid-columnHeader": {
              backgroundColor: "white !important",
            },
            "& .MuiDataGrid-columnHeaderTitle": {
              backgroundColor: "white !important",
            },
            "& .MuiDataGrid-row": {
              cursor: "pointer",
              "&:hover": {
                backgroundColor: "rgba(0, 0, 0, 0.04) !important",
              },
            },
            "& .MuiDataGrid-cell": {
              cursor: "pointer",
            },
            "& .MuiDataGrid-cell[data-field='actions']": {
              cursor: "default",
            },
            "& .MuiDataGrid-cell[data-field='openProject']": {
              cursor: "default",
            },
          }}
        />
      </Box>

      <DialogDeleteProject
        open={openDelete}
        onClose={() => setDeleteProjectId(null)}
        projectId={deleteProjectId}
      />
    </>
  );
}
