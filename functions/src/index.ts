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
import * as ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg'; 
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { onObjectFinalized } from "firebase-functions/v2/storage";

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

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export const convertToHLS = onObjectFinalized({ region: "us-central1" }, async (event) => {
  const object = event.data;
  const filePath = object.name;
  const contentType = object.contentType;
  const bucketName = object.bucket;

  // Make sure file exists and is an mp4 video
  if (!filePath || !contentType || !bucketName) {
    console.log('Missing required file details.');
    return null;
  }
  if (!filePath.endsWith('.mp4')) {
    console.log('Not an mp4 file. Skipping...');
    return null;
  }

  const bucket = admin.storage().bucket(bucketName);
  // Remove the '.mp4' extension from the file name
  const fileName = path.basename(filePath, '.mp4');
  const tempLocalFile = path.join(os.tmpdir(), `${fileName}.mp4`);
  const tempOutputDir = path.join(os.tmpdir(), fileName);

  // Create the temporary output directory
  await fs.promises.mkdir(tempOutputDir, { recursive: true });

  // Download file to temporary directory
  await bucket.file(filePath).download({ destination: tempLocalFile });
  console.log('Video downloaded to', tempLocalFile);

  // Set the output m3u8 playlist path
  const m3u8Path = path.join(tempOutputDir, 'index.m3u8');

  // Run FFmpeg command to convert the mp4 to HLS
  await new Promise<void>((resolve, reject) => {
    ffmpeg(tempLocalFile)
      .outputOptions([
        '-codec: copy',
        '-start_number 0',
        '-hls_time 5',
        '-hls_list_size 0',
        '-f hls',
      ])
      .output(m3u8Path)
      .on('end', () => {
        console.log('FFmpeg conversion finished.');
        resolve();
      })
      .on('error', (err: any) => {
        console.error('Error during FFmpeg conversion:', err);
        reject(err);
      })
      .run();
  });

  console.log('HLS files generated in', tempOutputDir);

  // Upload each file (.ts and .m3u8) back to Firebase Storage under hls/<fileName>/...
  const files = fs.readdirSync(tempOutputDir);
  const uploadPromises = files.map(async (filename) => {
    const localFilePath = path.join(tempOutputDir, filename);
    const destination = `hls/${fileName}/${filename}`;
    await bucket.upload(localFilePath, {
      destination,
      contentType: filename.endsWith('.m3u8')
        ? 'application/x-mpegURL'
        : 'video/MP2T',
    });
    console.log('Uploaded', destination);
  });

  await Promise.all(uploadPromises);
  console.log('All HLS parts uploaded.');

  // Clean up temporary files and directories
  try {
    fs.rmSync(tempLocalFile, { force: true });
    fs.rmSync(tempOutputDir, { recursive: true, force: true });
    console.log('Temporary files cleaned up.');
  } catch (error) {
    console.error('Error cleaning up temporary files:', error);
  }

  return null;
});

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
