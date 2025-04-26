import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { getFirestore, doc, getDoc } from '@react-native-firebase/firestore';

const functions = getFunctions();
const sendNotification = httpsCallable(functions, "sendNotification");
const sendDataNotification = httpsCallable(functions, "sendDataNotification");

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

export const sendDMNotification = async (fcmTokens: string[], message) => {
  if (fcmTokens.length === 0) return;
  const db = getFirestore();
  const senderRef = doc(db, 'users', message.sender);
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
      body: message.text,
      data: {
        purpose: 'dm',
        customKey: String(message.chatId),
        sender: String(message.sender),
        tag: String(message.messageId),
        id: String(message.id),
        receiver: String(message.receiver),
        text: String(message.text),
        media: String(message.media),
        replyTo: String(message.replyTo),
        timestamp: String(message.timestamp),
        delivered: String(message.delivered),
        seen: String(message.seen),
      }
    });
    console.log("Notification sent:", res.data);
  } catch (err) {
    console.error("Error sending notification:", err);
  }
}

export const sendDeleteNotification = async (fcmTokens: string[], messageId: string) => {
  if (fcmTokens.length === 0) return;
  try {
    const res = await sendDataNotification({
      token: fcmTokens, // pass array
      data: {
        'purpose': 'delete',
        'customKey': messageId,
      }
    });
    console.log("Notification sent:", res.data);
  } catch (err) {
    console.error("Error sending notification:", err);
  }
}

export const sendGroupNotification = async (fcmTokens: string[], message ,groupName:String) => {
  if (fcmTokens.length === 0) return;
  
  try {
    const res = await sendNotification({
      token: fcmTokens, // pass array
      title: `${groupName}:${message.senderName} sent a message`,
      body: message.text,
      data: {
        purpose: 'group',
        sender: String(message.sender),
        id: String(message.id),
        groupId: String(message.groupId),
      }
    });
    console.log("Notification sent:", res.data);
  } catch (err) {
    console.error("Error sending notification:", err);
  }
}

export const sendAddedToGroupNotification = async (fcmTokens: string[], groupName: string, groupId: string, addedBy: string) => {
  if (fcmTokens.length === 0) return;
  const db = getFirestore();
  const senderRef = doc(db, 'users', addedBy);
  const senderSnap = await getDoc(senderRef);
  const senderName = senderSnap.data()?.username;
  if (!senderName) {
    console.error("Sender name not found");
    return;
  }

  try {
    const res = await sendNotification({
      token: fcmTokens, // pass array 
      title: `${groupName}:${senderName} added you to the group`,
      body: "Click to view the group",
      data: {
        purpose: 'addedToGroup',
        customKey: groupId,
        sender: String(addedBy),
        groupId: String(groupId),
      }
    });
    console.log("Notification sent:", res.data);
  } catch (err) {
    console.error("Error sending notification:", err);
  }
}

export default sendNotificationAsync;
