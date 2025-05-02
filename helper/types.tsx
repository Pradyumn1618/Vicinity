import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";

export type rootStackParamList = {
    Home: undefined;
    Events: undefined;
    Login: undefined;
    Signup: undefined;
    Onboarding: undefined;
    Profile: undefined;
    UpdateProfile: undefined;
    ChatScreen: { chatId: string; receiver: string };
    FullProfile: { profilePic: string; username: string };
    PostList: { id: string; mediaType: string ; mediaUrl: string; caption?: string; createdAt: any; 
        fileSize?: string };
    Inbox: undefined;
    ChatUserProfile: {
        chatId: string;
        receiverDetails: {
            profilePic: string;
            username: string;
            status: string;
        };
    };
    GroupChatScreen: {groupId:string};
    CreateGroupScreen: undefined;
    GroupDetailsScreen: { groupId: string };
    PostScreen: undefined;
    CreatePost: undefined;
    Post: {postId:string}
    Search: undefined;
};

export interface Post {
    id: string;
    title: string;
    username: string;
    userId: string;
    profilePic: string;
    content: string;
    mediaUrls: string[];
    createdAt: FirebaseFirestoreTypes.Timestamp | null;
    geohash6: string;
    geohash5: string;
    geohash4: string;
    commentCount: number;
    likeCount: number;
}