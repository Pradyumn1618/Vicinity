/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { onCall } from "firebase-functions/v2/https";

// Initialize Admin SDK once
if (!admin.apps.length) {
  admin.initializeApp();
}

export const sendDataNotification = onCall(async (request) => {
  const { token, data } = request.data;

  if (!token || !Array.isArray(token) || token.length === 0) {
    throw new functions.https.HttpsError("invalid-argument", "token must be a non-empty array");
  }

  const messaging = admin.messaging();

  const responses = await Promise.all(
    token.map(async (t: string) => {
      try {
        const res = await messaging.send({
          token: t,
          data,
          android: {
            priority: "high", // Set priority for Android
          },
        });
        return { token: t, success: true, res };
      } catch (err) {
        console.error(`Error sending to ${t}:`, err);
        return { token: t, success: false, error: err };
      }
    })
  );

  const successCount = responses.filter((r) => r.success).length;
  const failureCount = responses.length - successCount;

  return {
    success: true,
    successCount,
    failureCount,
    android: {
      priority: "high", // Set priority for Android
    },
    responses,
  };
});

export const sendNotification = onCall(async (request) => {
  const { token, title, body, data } = request.data;
  if (!token || !Array.isArray(token) || token.length === 0) {
    throw new functions.https.HttpsError("invalid-argument", "token must be a non-empty array");
  }
  if (!title || !body) {
    throw new functions.https.HttpsError("invalid-argument", "title and body must be provided");
  }
  const messaging = admin.messaging();
  const responses = await Promise.all(
    token.map(async (t: string) => {
      try {
        const res = await messaging.send({
          token: t,
          notification: {
            title,
            body,
          },
          android: {
            priority: "high", // Set priority for Android
          },
          data,
        });
        return { token: t, success: true, res };
      } catch (err) {
        console.error(`Error sending to ${t}:`, err);
        return { token: t, success: false, error: err };
      }
    })
  );
  const successCount = responses.filter((r) => r.success).length;
  const failureCount = responses.length - successCount;
  return {
    success: true,
    successCount,
    failureCount,
    responses,
  };
});

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
