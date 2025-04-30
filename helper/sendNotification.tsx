import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { getFirestore, doc, getDoc } from '@react-native-firebase/firestore';
import { group } from 'console';

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
        'customKey': String(messageId),
      }
    });
    console.log("Notification sent:", res.data);
  } catch (err) {
    console.error("Error sending notification:", err);
  }
}

export const sendGroupNotification = async (groupId: string, message, currentUser: string, replyTo: string = null) => {
  const fdb = getFirestore();
  const groupRef = doc(fdb, 'groups', groupId);
  const groupSnap = await getDoc(groupRef);
  const groupData = groupSnap.data();
  if (!groupData) {
    console.error("Group data not found");
    return;
  }
  let replyToSender = null;
  if (!replyTo) {
    const messageRef = doc(fdb, 'groups', groupId, 'messages', replyTo);
    const messageSnap = await getDoc(messageRef);
    const messageData = messageSnap.data();
    if (!messageData) {
      console.error("Message data not found");
      return;
    }
    replyToSender = messageData.sender;
    const senderRef = doc(fdb, 'users', messageData.sender);
    const senderSnap = await getDoc(senderRef);
    const token = senderSnap.data()?.fcmToken;
    const Muted = senderSnap.data()?.muted;
    const isMuted = Muted?.find((group) => group === groupId);

    if (token) {
      if (isMuted) {
        try {
          const res = await sendDataNotification({
            token: [token],
            data: {
              purpose: 'group-message',
              customKey: String(groupId),
              sender: String(message.sender),
              id: String(message.id),
            },
          });
          console.log("Notification sent:", res.data);
        } catch (error) {
          console.error("Error sending notification:", error);
        }

      } else {
        try {
          const res = await sendNotification({
            token: [token], // pass array
            title: `${groupData.groupName}:${message.senderName} replied to your message`,
            body: message.text,
            data: {
              purpose: 'group-message',
              customKey: String(groupId),
              sender: String(message.sender),
              id: String(message.id),
            },
          });
          console.log("Notification sent:", res.data);
        } catch (err) {
          console.error("Error sending notification:", err);
        }
      }
    }

  }

  let MutedMembers = [];
  let mutedFcmTokens = [];

  const members = groupData.members;
  const fcmTokens = members.map(async (member) => {
    if (member === currentUser) return undefined;
    if (member === replyToSender) return undefined;
    const userRef = doc(fdb, 'users', member);
    const userSnap = await getDoc(userRef);
    const muted = userSnap.data()?.muted;
    const isMuted = muted?.find((group) => group === groupId);
    if (isMuted) {
      MutedMembers.push(member);
      mutedFcmTokens.push(userSnap.data()?.fcmToken);
      return undefined;
    }
    return userSnap.data()?.fcmToken;
  }).filter(token => token !== undefined);

  mutedFcmTokens = mutedFcmTokens.filter(token => token !== undefined);

  try {
    const res = await sendNotification({
      token: fcmTokens, // pass array
      title: `${groupData.groupName}:${message.senderName} sent a message`,
      body: message.text,
      data: {
        purpose: 'group-message',
        sender: String(message.sender),
        id: String(message.id),
        customKey: String(groupId),
      }
    });
    console.log("Notification sent:", res.data);
  } catch (err) {
    console.error("Error sending notification:", err);
  }

  try {
    const res = await sendDataNotification({
      token: mutedFcmTokens, // pass array
      data: {
        purpose: 'group-message',
        sender: String(message.sender),
        id: String(message.id),
        customKey: String(groupId),
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
