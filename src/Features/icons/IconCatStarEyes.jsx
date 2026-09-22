import SvgIcon from "@mui/material/SvgIcon";

// Chat-tool icon: an emoji-like cat head (pun on "chat") with star-shaped
// eyes. Single path with even-odd fill so the eyes, nose and mouth are
// punched out of the head and stay readable on any background.
const IconCatStarEyes = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <path
      fillRule="evenodd"
      d="M4.5 2.5L9.5 5.6A8.5 8.5 0 0 1 14.5 5.6L19.5 2.5L20.2 11A8.5 8.5 0 1 1 3.8 11ZM8.6 9L9.2 10.7L11.1 10.8L9.6 11.9L10.1 13.7L8.6 12.7L7.1 13.7L7.6 11.9L6.1 10.8L8 10.7ZM15.4 9L16 10.7L17.9 10.8L16.4 11.9L16.9 13.7L15.4 12.7L13.9 13.7L14.4 11.9L12.9 10.8L14.8 10.7ZM11 14.6h2l-1 1.3zM9.9 16.6c.6 1.1 1.5 1.3 2.1.6c.6.7 1.5.5 2.1-.6l.6.4c-.8 1.4-2 1.7-2.7 1c-.7.7-1.9.4-2.7-1z"
    />
  </SvgIcon>
);

export default IconCatStarEyes;
