import {useDispatch} from "react-redux";

import {sendMessageContent, receiveMessageContent} from "../chatSlice";

import useToken from "Features/auth/hooks/useToken";
import useSendMessageProps from "./useSendMessageProps";

import sendMessageService from "../services/sendMessageService";

export default function useSendMessage() {
  const dispatch = useDispatch();
  const token = useToken();

  const {contextContent, tools, store} = useSendMessageProps();

  const send = async (content) => {
    const contentWithContext = content + " " + contextContent;
    try {
      // step 1
      dispatch(sendMessageContent(content));

      // step 2
      console.log("[sendMessage] sending message", contentWithContext);
      const response = await sendMessageService({
        messages: [{role: "user", content: contentWithContext}],
        tools,
        store,
        accessToken: token,
      });
      console.log("[sendMessage] response", response);

      if (response.message?.content) {
        console.log("message content", response.message.content);
      }

      // step 3
      dispatch(receiveMessageContent("reçu"));

      // return
      return response.message;
    } catch (err) {
      console.error("Error during message sending:", err);
    }
  };

  return send;
}
