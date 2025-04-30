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
}