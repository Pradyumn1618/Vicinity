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
  replyTo?: {text:string,id:string} | null;
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
  index: number; // The index of the message in the list
  currentUserId?: string | null; // The ID of the current user
  highlightedMessageId?: string | null; // The ID of the highlighted message for styling
  handleScrollToReply: (messageId: string) => void; // Function to scroll to the message being replied to
  renderMedia: (mediaUrl: string, onPress: () => void) => JSX.Element | null; // Function to render media (image/video)
  handleMediaPress: (mediaUrl: string) => void; // Function to handle media press (e.g., view media)
  handleLongPress: (messageText: string) => void; // Function to handle long press on a message (e.g., copy)
  handleReply: (message: Message) => void; // Function to handle replying to a message
  handleDelete: (messageId: string) => void; // Function to handle deleting a message
}

const RenderMessage = ({
  item,
  index,
  currentUserId,
  highlightedMessageId,
  handleScrollToReply,
  renderMedia,
  handleMediaPress,
  handleLongPress,
  handleReply,
  handleDelete
}: RenderMessageProps) => {

  // console.log('type',item.type);

  if (item.type === 'divider') {
    const label = moment(item.date).calendar(null, {
      sameDay: '[Today]',
      lastDay: '[Yesterday]',
      lastWeek: 'dddd',
      sameElse: 'MMMM D, YYYY',
    });
    // console.log('divider', label);
    return (
      <View className="w-full flex-row justify-center items-center my-2">
        <View className="bg-gray-600 dark:bg-gray-800 px-3 py-1 rounded-full shadow-sm">
          <Text className="text-xs text-white dark:text-gray-200 font-medium">{label}</Text>
        </View>
      </View>

    );
  }

  const isMine = item.sender === currentUserId;
  const isHighlighted = item.id === highlightedMessageId;

  // console.log("RenderMessage", { itemId: item.id, highlightedMessageId, isHighlighted });

  return (
    <View className={`flex-row ${isMine ? 'justify-end' : 'justify-start'} flex`}>
      <View className={`max-w-[80%] p-3 rounded-xl mb-2 ${isMine ? 'bg-blue-600' : 'bg-zinc-700'} ${isHighlighted ? 'border-2 border-yellow-400' : ''}`}>

        {item.replyTo && (
          <View className="mb-2">
            <TouchableOpacity onPress={() => handleScrollToReply(item.replyTo.id || '')}>
              <View className="flex-row items-center mb-1">
                <View className="h-full border-l-2 border-white mr-2" />
                <Text className="text-white text-xs italic">Reply: {item.replyTo.text}</Text>
              </View>
            </TouchableOpacity>

          </View>
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
};

export default React.memo(RenderMessage, (prevProps, nextProps) => {
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.highlightedMessageId === nextProps.highlightedMessageId
    && prevProps.item.type === 'message' && nextProps.item.type === 'message'
    && prevProps.item.delivered === nextProps.item.delivered
    && prevProps.item.seen === nextProps.item.seen
  );
});
