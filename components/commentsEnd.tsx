import React from "react";
import { ActivityIndicator, Text } from "react-native";

export const EmptyComments = () => (
    <Text className="text-zinc-400 text-center mt-4">No comments yet.</Text>
  );
  
export const FooterLoader = ({ loading }) =>
    loading ? <ActivityIndicator className="my-4" color="white" /> : null;