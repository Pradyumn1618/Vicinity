import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import Ionicons from "react-native-vector-icons/Ionicons";

interface Message {
    id: string;
    text: string;
    sender: string;
    timestamp: number;
    media?: string | null;
    replyTo?: string | null;
    delivered?: boolean;
    seen?: boolean;
  }


export const MessageBubble = React.memo(({
    item,
    isMine,
    isHighlighted,
    showUnreadDivider,
    onReply,
    onScrollToReply,
    handleDelete,
    renderMedia,
    handleMediaPress,
    ReplyText
  }: {
    item: Message;
    isMine: boolean;
    isHighlighted: boolean;
    showUnreadDivider: boolean;
    onReply: (message: Message) => void;
    onScrollToReply: (messageId: string) => void;
    handleDelete: (messageId: string) => void;
    renderMedia: (media: string, onPress?: () => void) => JSX.Element;
    handleMediaPress: (uri: string) => void;
    ReplyText: string;
  }) => {
    const translateX = useSharedValue(0);
  
    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: translateX.value }],
    }));
  
    const swipeGesture = Gesture.Pan()
      .onUpdate((event) => {
        if (isMine && event.translationX < -50) {
          translateX.value = withSpring(-50);
        } else if (!isMine && event.translationX > 50) {
          translateX.value = withSpring(50);
        }
      })
      .onEnd(() => {
        if ((isMine && translateX.value < -5) || (!isMine && translateX.value > 5)) {
          runOnJS(onReply)(item);
        }
        translateX.value = withSpring(0);
      });
  
    return (
      <GestureDetector gesture={swipeGesture}>
        <Animated.View style={animatedStyle}>
          <View
            className={`max-w-[80%] p-3 rounded-xl mb-2 ${isMine ? 'self-end bg-blue-600' : 'self-start bg-zinc-700'
              } ${isHighlighted ? 'border-2 border-yellow-400' : ''}`}
          >
            {showUnreadDivider && (
              <View className="items-center my-3">
                <Text className="bg-blue-600 text-white px-4 py-1 rounded-full text-xs">
                  Unread Messages
                </Text>
              </View>
            )}
            {item.replyTo && (
              <TouchableOpacity onPress={() => item.replyTo && onScrollToReply(item.replyTo)}>
                <View className="mb-1 border-l-2 border-white pl-2">
                  <Text className="text-white text-xs italic">Reply: {ReplyText}</Text>
                </View>
              </TouchableOpacity>
            )}
            {item.media && renderMedia(item.media, () => handleMediaPress(item.media!))}
            <Text className="text-white">{item.text}</Text>
            <View className="flex-row justify-between mt-1">
              <Text className="text-xs text-gray-300">
                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              <View className="flex-row gap-x-2">
                <TouchableOpacity onPress={() => onReply(item)}>
                  <Ionicons name="return-up-back-outline" size={16} color="white" />
                </TouchableOpacity>
                {isMine && (
                  <TouchableOpacity onPress={() => handleDelete(item.id)}>
                    <Ionicons name="trash-outline" size={16} color="white" />
                  </TouchableOpacity>
                )}
                {isMine && item.delivered && !item.seen && (
                  <Ionicons name="checkmark" size={16} color="white" />
                )}
                {isMine && item.seen && (
                  <Ionicons name="checkmark-done" size={16} color="white" />
                )}
              </View>
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
    );
  });


  