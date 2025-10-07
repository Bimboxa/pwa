import { TextField, Box } from "@mui/material";

export default function FieldTextVariantToolbar({
  value,
  onChange,
  options,
  label,
  width,
  placeholder,
}) {
  // options

  const readOnly = options?.readOnly;

  // handlers

  function handleChange(e) {
    onChange(e.target.value);
  }

  return (
    <Box sx={{ width }}>
      <TextField
        readOnly={readOnly}
        fullWidth
        size="small"
        value={value ?? ""}
        onChange={handleChange}
        options={options ?? []}
        placeholder={placeholder}
        sx={{
          "& .MuiOutlinedInput-root": {
            "& fieldset": {
              border: "none",
            },
            "&:hover fieldset": {
              border: "none",
            },
            "&.Mui-focused fieldset": {
              border: "none",
            },
          },
          "& .MuiInputBase-input": {
            fontSize: "12px",
            ...(readOnly && {
              cursor: "default",
              caretColor: "transparent",
            }),
          },
        }}
      />
    </Box>
  );
}
