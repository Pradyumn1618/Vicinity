import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { getFirestore,doc, getDoc } from '@react-native-firebase/firestore';

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

export const sendDMNotification = async (fcmTokens: string[], senderId: string, message: string,chatId:string,messageId:string) => {
    if (fcmTokens.length === 0) return;
    const db = getFirestore();
    const senderRef = doc(db,'users',senderId);
    const senderSnap = await getDoc(senderRef);
    const senderName = senderSnap.data()?.username;
    if (!senderName) {
      console.error("Sender name not found");
      return;
    }

    try {
      const res = await sendNotification({
        token: fcmTokens, // pass array
        title: `${senderName} sent you a message`,
        body: message,
        tag: messageId,
        data: {
          purpose: 'dm',
          customKey: chatId,
          sender: senderId,
        }
      });
      console.log("Notification sent:", res.data);
    } catch (err) {
      console.error("Error sending notification:", err);
    }
  }

  export const sendDeleteNotification = async (fcmTokens: string[], messageId:string) => {
    if (fcmTokens.length === 0) return;
    try {
      const res = await sendNotification({
        token: fcmTokens, // pass array
        title: "Message Deleted",
        body: "A message has been deleted.",
        data: {
          purpose: 'delete',
          customKey: messageId,
        }
      });
      console.log("Notification sent:", res.data);
    } catch (err) {
      console.error("Error sending notification:", err);
    }
  }

  export const clearNotification = async (fcmTokens: string[], messageId:string) => {
    if (fcmTokens.length === 0) return;
    try {
      const res = await sendNotification({
        token: fcmTokens, // pass array
        title: '',
        body: '',
        tag: messageId,
        data: {
          purpose: 'clear-notification',
          customKey: messageId,
        }
      });
      console.log("Notification sent:", res.data);
    } catch (err) {
      console.error("Error sending notification:", err);
    }
  }
export default sendNotificationAsync;
