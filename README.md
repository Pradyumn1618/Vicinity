# Vicinity

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white&style=for-the-badge)](https://www.typescriptlang.org/)
[![React Native](https://img.shields.io/badge/React%20Native-20232A?logo=react&logoColor=61DAFB&style=for-the-badge)](https://reactnative.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?logo=firebase&logoColor=white&style=for-the-badge)](https://firebase.google.com/)

---

## 📱 Overview

**Vicinity** is a feature-rich social media mobile application built with React Native, designed to connect people in the vicinity with features like posting images and videos, creating events, and chatting. 

---

## 🚀 Features

### 🗨️ Chats
- **Direct Messaging**: 1:1 chats with users.
- **Group Chats**: Multiple users, shared media, group management.
- **Media Sharing**: Send images, videos.
- **Read Receipts**: Know when your message is seen.
- **Typing Indicators**: Know when the other person or persons are typing.
- **Search messages**: Search for messages in chat
- **Download media**: Download the shared media in chat

### 📅 Events
- **Create/Join Events**: Organize or participate in local happenings.
- **Event Visibility**: Make the event public or private. Add users in private events.
- **Event Discovery**: Browse events near your location.
- **Reminders & Notifications**: Stay updated with event alerts.

### 📰 Posting
- **Post Creation**: Share text, images, or video posts.
- **Feed**: Scroll through posts from people and events nearby.
- **Likes & Comments**: Engage with posts, reply to comments.
- **Share**: Share the post with anyone on any platform.

### 🌐 Geolocation
- **Nearby Discovery**: Find users, events, and posts around you.
- **Real-Time Location Updates**: Dynamic updates as you move.

### 🔔 Notifications
- **Push Notifications**: For messages, events, and post engagement.
- **Customizable Alerts**: Choose what you get notified about (limited).

### 👤 User Profile
- **Profile Customization**: Profile pics, bios.
- **Activity Tracking**: Your posts, events and saved posts in one place.

### 🛠️ More Features
- **Secure Authentication**: Firebase Auth, Google Sign-In.
- **Offline Support**: Access chats and cached posts even without internet.
- **Modern UI/UX**: Powered by NativeWind and React Native Paper.
- **Scalable Cloud Backend**: Firestore, Functions, and Storage.

---

## 🛠️ Tech Stack

| Category       | Tech/Library                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------- |
| **Languages**  | [![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/) |
| **Framework**  | [![React Native](https://img.shields.io/badge/-React%20Native-20232A?logo=react&logoColor=61DAFB)](https://reactnative.dev/) |
| **Backend**    | [![Firebase](https://img.shields.io/badge/-Firebase-FFCA28?logo=firebase&logoColor=white)](https://firebase.google.com/)  [![Node.js](https://img.shields.io/badge/-Node.js-339933?logo=node.js&logoColor=white)](https://nodejs.org/) |
| **UI**         | [![NativeWind](https://img.shields.io/badge/-NativeWind-06B6D4?logo=tailwindcss&logoColor=white)](https://www.nativewind.dev/), [![React Native Paper](https://img.shields.io/badge/-Paper-6200EE?logo=react&logoColor=white)](https://callstack.github.io/react-native-paper/) |
| **Linting**    | [![ESLint](https://img.shields.io/badge/-ESLint-4B32C3?logo=eslint&logoColor=white)](https://eslint.org/) |
| **Navigation** | [![React Navigation](https://img.shields.io/badge/-React%20Navigation-000000?logo=react&logoColor=white)](https://reactnavigation.org/) |

---


This is a new [**React Native**](https://reactnative.dev) project, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Getting Started

> **Note**: Place your google-service.json file in android/app directory
> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Step 1: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

The first time you create a new project, run the Ruby bundler to install CocoaPods itself:

```sh
bundle install
```

Then, and every time you update your native dependencies, run:

```sh
bundle exec pod install
```

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.

## Step 3: Modify your app

Now that you have successfully run the app, let's make changes!

Open `App.tsx` in your text editor of choice and make some changes. When you save, your app will automatically update and reflect these changes — this is powered by [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

When you want to forcefully reload, for example to reset the state of your app, you can perform a full reload:

- **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Dev Menu**, accessed via <kbd>Ctrl</kbd> + <kbd>M</kbd> (Windows/Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS).
- **iOS**: Press <kbd>R</kbd> in iOS Simulator.

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.
