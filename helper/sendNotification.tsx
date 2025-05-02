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

export const sendGroupNotification = async (
  groupId: string,
  message,
  currentUser: string,
  replyTo: string = null
) => {
  console.log("Sending group notification");
  const fdb = getFirestore();
  const groupRef = doc(fdb, 'groups', groupId);
  const groupSnap = await getDoc(groupRef);
  const groupData = groupSnap.data();

  if (!groupData) {
    console.error("Group data not found");
    return;
  }

  let replyToSender = null;

  // --- Handle reply message sender separately ---
  if (replyTo) {
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
    const senderData = senderSnap.data();
    const token = senderData?.fcmToken;
    const mutedGroups = senderData?.muted || [];
    const isMuted = mutedGroups.includes(groupId);

    if (token) {
      const payload = {
        token: [token],
        data: {
          purpose: 'group-message',
          customKey: String(groupId),
          sender: String(message.sender),
          id: String(message.id),
        },
      };

      try {
        const res = isMuted
          ? await sendDataNotification(payload)
          : await sendNotification({
              ...payload,
              title: `${groupData.groupName}: ${message.senderName} replied to your message`,
              body: message.text,
            });
        console.log("Reply notification sent:", res.data);
      } catch (err) {
        console.error("Error sending reply notification:", err);
      }
    }
  }

  // --- Notify all group members except sender & replyToSender ---
  const mutedFcmTokens: string[] = [];
  const normalFcmTokens: string[] = [];

  const members = groupData.members || [];

  const tokenPromises = members.map(async (member) => {
    if (member === currentUser || member === replyToSender) return;

    const userRef = doc(fdb, 'users', member);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();
    const token = userData?.fcmToken;
    const mutedGroups = userData?.muted || [];
    const isMuted = mutedGroups.includes(groupId);

    if (token) {
      if (isMuted) {
        mutedFcmTokens.push(token);
      } else {
        normalFcmTokens.push(token);
      }
    }
  });

  await Promise.all(tokenPromises); // Wait for all tokens to be resolved

  // --- Send notifications to normal members ---
  if (normalFcmTokens.length > 0) {
    try {
      const res = await sendNotification({
        token: normalFcmTokens,
        title: `${groupData.groupName}: ${message.senderName} sent a message`,
        body: message.text,
        data: {
          purpose: 'group-message',
          sender: String(message.sender),
          id: String(message.id),
          customKey: String(groupId),
        },
      });
      console.log("Notification sent to normal members:", res.data);
    } catch (err) {
      console.error("Error sending notification to normal members:", err);
    }
  }

  // --- Send silent data notifications to muted members ---
  if (mutedFcmTokens.length > 0) {
    try {
      const res = await sendDataNotification({
        token: mutedFcmTokens,
        data: {
          purpose: 'group-message',
          sender: String(message.sender),
          id: String(message.id),
          customKey: String(groupId),
        },
      });
      console.log("Data notification sent to muted members:", res.data);
    } catch (err) {
      console.error("Error sending data notification to muted members:", err);
    }
  }
};


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
