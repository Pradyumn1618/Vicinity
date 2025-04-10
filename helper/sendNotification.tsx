import { getFunctions, httpsCallable } from '@react-native-firebase/functions';

const functions = getFunctions();
const sendNotification = httpsCallable(functions, "sendNotification");

const sendNotificationAsync = async (fcmTokens: string[]) => {
    if (fcmTokens.length === 0) return;
  
    try {
      const res = await sendNotification({
        token: fcmTokens, // pass array
        title: "Hello 👋",
        body: "This is a test notification!",
        data: {
          customKey: "customValue"
        }
      });
      console.log("Notification sent:", res.data);
    } catch (err) {
      console.error("Error sending notification:", err);
    }
  };

export default sendNotificationAsync;
