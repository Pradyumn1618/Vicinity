export type rootStackParamList = {
    Home: undefined;
    Events: undefined;
    Login: undefined;
    Signup: undefined;
    Onboarding: undefined;
    Profile: undefined;
    UpdateProfile: undefined;
    ChatScreen: { chatId: string; receiver: string };
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
}