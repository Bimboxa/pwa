import React, {useRef, useEffect, useState} from "react";
import jsQR from "jsqr";

export default function QrCodeReader({onScan}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    const startVideo = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {facingMode: "environment"},
        });
        video.srcObject = stream;
        video.setAttribute("playsinline", true); // required to tell iOS safari we don't want fullscreen
        video.play();
        requestAnimationFrame(tick);
      } catch (err) {
        setError("Error accessing camera: " + err.message);
      }
    };

    const tick = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height
        );
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });
        if (code) {
          onScan(code.data);
        }
      }
      requestAnimationFrame(tick);
    };

    startVideo();

    return () => {
      if (video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div style={{position: "relative", display: "flex"}}>
      {error && <p>{error}</p>}
      <video ref={videoRef} style={{display: "none"}} />
      <canvas ref={canvasRef} style={{width: "100%"}} />
    </div>
  );
}
