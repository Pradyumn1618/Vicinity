/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import 'react-native-get-random-values';
import messaging from '@react-native-firebase/messaging';
import PushNotification from 'react-native-push-notification';
import {deleteMessage,insertMessage,incrementUnreadCount,decrementUnreadCount} from './helper/databaseHelper'





messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('Background notification received:', remoteMessage);
      if (remoteMessage.data) {
        if (remoteMessage.data.purpose === 'dm') {
          const message = {
            id: remoteMessage.data.id,
            sender: remoteMessage.data.sender,
            text: remoteMessage.data.text,
            media: remoteMessage.data.media,
            replyTo: remoteMessage.data.replyTo,
            timestamp: remoteMessage.data.timestamp,
            delivered: remoteMessage.data.delivered,
            seen: remoteMessage.data.seen,
          }
          await insertMessage(message,remoteMessage.data.customKey, remoteMessage.data.receiver);
          incrementUnreadCount(remoteMessage.data.customKey);
          return;
        }else if (remoteMessage.data.purpose === 'delete') {
          const messageId = remoteMessage.data?.customKey;
          if (messageId) {
            await deleteMessage(messageId);
            decrementUnreadCount(remoteMessage.data.customKey);
            console.log('Message deleted:', messageId);
          } else {
            console.log('No message ID provided for deletion');
          }
          return;
        }else if (remoteMessage.data.purpose === 'clear-notification') {
          const messageId = remoteMessage.data?.tag;
          PushNotification.cancelLocalNotification(messageId);
          return;
        }
      }
      
    });


AppRegistry.registerComponent(appName, () => App);
