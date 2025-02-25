import axiosClient from "App/axiosClient";

import store from "App/store";

export async function postAutoSegmentationRequest({blob, fileName}) {
  const formData = new FormData();
  formData.append("image", blob, fileName);

  // debug
  console.log("Posting auto segmentation request...", formData);

  // ngrokId
  const ngrokId =
    store.getState().settings.servicesConfig.autoSegmentation.ngrokId;
  try {
    const response = await client.post(
      `https://${ngrokId}.ngrok-free.app/api/segmentation`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    const {task_id} = response.data;
    return {taskId: task_id};
  } catch (error) {
    console.error("Error posting auto segmentation request:", error);
    throw error;
  }
}

export async function getAutoSegmentationTaskResult(requestId) {
  const url = `https://b3c1-2a01-e0a-432-cda0-67c2-3aa1-3795-81f.ngrok-free.app/status/${requestId}`;

  try {
    const response = await client.get(url, {
      headers: {"ngrok-skip-browser-warning": "69420"},
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching auto segmentation task status:", error);
    throw error;
  }
}
