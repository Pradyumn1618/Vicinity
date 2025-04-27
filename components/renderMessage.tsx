import moment from "moment";
import React from "react";
import { Pressable, Text, TouchableOpacity, View } from "react-native";
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

type DividerItem = {
    type: 'divider';
    date: number;
    id: string;
};

type DecoratedMessage = Message & { type: 'message' } | DividerItem;

interface RenderMessageProps {
    item: DecoratedMessage; // The message or divider object
    currentUserId?: string | null; // The ID of the current user
    highlightedMessageId?: string | null; // The ID of the highlighted message for styling
    handleScrollToReply: (messageId: string) => void; // Function to scroll to the message being replied to
    getTextfromId: (id: string) => string; // Function to get text of a message by ID (for reply)
    renderMedia: (mediaUrl: string, onPress: () => void) => JSX.Element | null; // Function to render media (image/video)
    handleMediaPress: (mediaUrl: string) => void; // Function to handle media press (e.g., view media)
    handleLongPress: (messageText: string) => void; // Function to handle long press on a message (e.g., copy)
    handleReply: (message: Message) => void; // Function to handle replying to a message
    handleDelete: (messageId: string) => void; // Function to handle deleting a message
}

const RenderMessage = React.memo(({
  item,
  currentUserId,
  highlightedMessageId,
  handleScrollToReply,
  getTextfromId,
  renderMedia,
  handleMediaPress,
  handleLongPress,
  handleReply,
  handleDelete
}: RenderMessageProps) => {

    if (item.type === 'divider') {
      const label = moment(item.date).calendar(null, {
        sameDay: '[Today]',
        lastDay: '[Yesterday]',
        lastWeek: 'dddd',
        sameElse: 'MMMM D, YYYY',
      });
      return (
        <View className="flex-row justify-center items-center my-2">
          <View className="bg-gray-300 dark:bg-gray-700 px-3 py-1 rounded-full shadow-sm">
            <Text className="text-xs text-gray-800 dark:text-gray-200 font-large">{label}</Text>
          </View>
        </View>
      );
    }

    const isMine = item.sender === currentUserId;
    const isHighlighted = item.id === highlightedMessageId;

    return (
      <View>
        <View
          className={`max-w-[80%] p-3 rounded-xl mb-2 ${isMine ? 'self-end bg-blue-600' : 'self-start bg-zinc-700'
            } ${isHighlighted ? 'border-2 border-yellow-400' : ''}`}
        >
          {item.replyTo && (
            <TouchableOpacity onPress={() => handleScrollToReply(item.replyTo || '')}>
              <View className="mb-1 border-l-2 border-white pl-2">
                <Text className="text-white text-xs italic">Reply: {getTextfromId(item.replyTo)}</Text>
              </View>
            </TouchableOpacity>
          )}
          {item.media ? renderMedia(item.media as string, () => handleMediaPress(item.media as string)) : null}
          <Pressable onLongPress={() => handleLongPress(item.text)}>
            <Text className="text-white">{item.text}</Text>
          </Pressable>
          <View className="flex-row justify-between mt-1">
            <Text className="text-xs text-gray-300">
              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <View className="flex-row gap-x-2">
              <TouchableOpacity onPress={() => handleReply(item)}>
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
      </View>
    );
});

export default RenderMessage;
