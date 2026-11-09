import deleteProfileLinesService from "Features/elevation/services/deleteProfileLinesService";

// Deletes profileLine(s) from an annotation's `profileLines` sequence and
// drops the db.points they referenced (deleteProfileLinesService).
//
//   - { annotationId, index }  → delete that single profile line.
//   - { annotationId }         → delete ALL profile lines.
export default function useDeleteProfileLine() {
  return async ({ annotationId, index } = {}) => {
    await deleteProfileLinesService({
      annotationId,
      indices: index == null ? null : [index],
    });
  };
}
