import { useEffect, useMemo, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { Box, Chip, Typography } from "@mui/material";
import {
  Notes as TextIcon,
  Event as EventIcon,
  ImageNotSupported as MissingMediaIcon,
} from "@mui/icons-material";

import db from "App/db/db";

// Notes feed of a Krnet-imported business object: the free notes (photos,
// comments, audio, events) added on the object in notes-app, imported at
// sync time under businessObject.notesAppNotes (media binaries in db.files).

const LEVEL_PROPS = {
  alert: { label: "Alerte", color: "warning" },
  blocking: { label: "Bloquant", color: "error" },
};

function formatDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return null;
  }
}

export default function SectionNotesAppObjectNotes({ businessObject }) {
  // strings

  const emptyS = "Aucune note sur cet objet.";
  const missingMediaS = "Média non synchronisé";

  // data

  const notes = useMemo(
    () => businessObject?.notesAppNotes ?? [],
    [businessObject?.notesAppNotes]
  );

  // media blob URLs from db.files (revoked on change/unmount)

  const fileNames = notes.filter((n) => n.fileName).map((n) => n.fileName);
  const fileNamesKey = fileNames.join(",");
  const blobUrlsRef = useRef([]);

  const mediaUrlByFileName = useLiveQuery(async () => {
    blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    blobUrlsRef.current = [];
    if (!fileNames.length) return {};
    const files = await db.files.bulkGet(fileNames);
    const byFileName = {};
    files.forEach((file) => {
      if (!file?.fileArrayBuffer) return;
      const url = URL.createObjectURL(
        new Blob([file.fileArrayBuffer], { type: file.fileMime })
      );
      blobUrlsRef.current.push(url);
      byFileName[file.fileName] = url;
    });
    return byFileName;
  }, [fileNamesKey]);

  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlsRef.current = [];
    };
  }, []);

  // render

  if (notes.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
        {emptyS}
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        p: 1.5,
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        overflowY: "auto",
        flex: 1,
      }}
    >
      {notes.map((note) => {
        const dateS = formatDate(note.createdAt);
        const level = LEVEL_PROPS[note.level];
        const mediaUrl = note.fileName
          ? mediaUrlByFileName?.[note.fileName]
          : null;
        const isMedia = note.type === "photo" || note.type === "audio";

        return (
          <Box
            key={note.idMaster}
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 0.5,
              p: 1,
              borderRadius: 1,
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: level
                ? `${level.color}.light`
                : "divider",
            }}
          >
            {/* header: date + level */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {dateS}
              </Typography>
              {level && (
                <Chip size="small" label={level.label} color={level.color} />
              )}
            </Box>

            {/* content per type */}
            {note.type === "photo" &&
              (mediaUrl ? (
                <Box
                  component="img"
                  src={mediaUrl}
                  alt="Photo"
                  sx={{ width: 1, borderRadius: 1, display: "block" }}
                />
              ) : (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    color: "text.secondary",
                  }}
                >
                  <MissingMediaIcon fontSize="small" />
                  <Typography variant="caption">{missingMediaS}</Typography>
                </Box>
              ))}

            {note.type === "audio" &&
              (mediaUrl ? (
                <Box
                  component="audio"
                  controls
                  src={mediaUrl}
                  sx={{ width: 1 }}
                />
              ) : (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    color: "text.secondary",
                  }}
                >
                  <MissingMediaIcon fontSize="small" />
                  <Typography variant="caption">{missingMediaS}</Typography>
                </Box>
              ))}

            {note.type === "text" && (
              <Box sx={{ display: "flex", gap: 1 }}>
                <TextIcon fontSize="small" color="action" sx={{ mt: 0.25 }} />
                <Typography
                  variant="body2"
                  sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                >
                  {note.content}
                </Typography>
              </Box>
            )}

            {note.type === "event" && (
              <Box sx={{ display: "flex", gap: 1 }}>
                <EventIcon fontSize="small" color="action" sx={{ mt: 0.25 }} />
                <Typography
                  variant="body2"
                  sx={{ fontStyle: "italic", wordBreak: "break-word" }}
                >
                  {note.content}
                </Typography>
              </Box>
            )}

            {/* unknown types (future): raw content fallback */}
            {!isMedia &&
              note.type !== "text" &&
              note.type !== "event" &&
              note.content && (
                <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
                  {note.content}
                </Typography>
              )}
          </Box>
        );
      })}
    </Box>
  );
}
