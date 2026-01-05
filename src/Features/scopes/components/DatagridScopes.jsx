import { useCallback, useState } from "react";

import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

import { setSelectedScopeId } from "../scopesSlice";
import { setSelectedProjectId } from "Features/projects/projectsSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { DataGridPro, GridActionsCellItem } from "@mui/x-data-grid-pro";

import { Box } from "@mui/material";
import { Delete } from "@mui/icons-material";

import DialogDeleteScope from "./DialogDeleteScope";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

export default function DatagridScopes({ scopes }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // data

  const appConfig = useAppConfig();

  // helpers

  const scopeName = appConfig?.strings?.scope?.nameSingular;
  const projectName = appConfig?.strings?.project?.nameSingular;
  const projectClientRef = appConfig?.strings?.project?.clientRef;
  const scopeProjectName = appConfig?.strings?.scopeProject?.nameSingular;
  const scopeProjectClientRef = appConfig?.strings?.scopeProject?.clientRef;

  // state

  const [deleteScopeId, setDeleteScopeId] = useState(null);
  const openDelete = Boolean(deleteScopeId);

  // handlers

  function handleOpenScope({ projectId, scopeId }) {
    dispatch(setSelectedScopeId(scopeId));
    dispatch(setSelectedProjectId(projectId));
    navigate(`/`);
  }

  // columns

  const columns = [
    { field: "scopeProjectName", headerName: projectName, flex: 1 },
    { field: "scopeName", headerName: scopeName, flex: 1 },
    //{ field: "scopeClientRef", headerName: "Réf.", flex: 1 },

    //{ field: "scopeProjectClientRef", headerName: "Réf. projet", flex: 1 },
    {
      field: "openScope",
      headerName: "",
      width: 100,
      type: "actions",
      getActions: (params) => [
        <ButtonGeneric
          variant="contained"
          size="small"
          label="Ouvrir"
          onClick={() =>
            handleOpenScope({
              projectId: params.row.projectId,
              scopeId: params.row.scopeId ? params.row.id : null,
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
            onClick={() => setDeleteScopeId(params.id)}
          />,
        ];
      },
    },
  ];

  // rows

  const rows = scopes?.map((scope) => ({
    ...scope,
    //scopeName: scope.name,
    //scopeClientRef: scope.clientRef,
    //scopeProjectName: scope.projectName,
    //scopeProjectClientRef: scope.projectClientRef,
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
            if (params.field !== "actions" && params.field !== "openScope") {
              handleOpenScope({
                projectId: params.row.projectId,
                scopeId: params.row.id,
              });
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
            "& .MuiDataGrid-cell[data-field='openScope']": {
              cursor: "default",
            },
          }}

        />
      </Box>

      <DialogDeleteScope
        open={openDelete}
        onClose={() => setDeleteScopeId(null)}
        scopeId={deleteScopeId}
      />
    </>
  );
}
