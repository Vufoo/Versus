import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TabNavigator from './TabNavigator';
import MessagesScreen from '../screens/MessagesScreen';
import ChatScreen from '../screens/ChatScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SearchScreen from '../screens/SearchScreen';
import FollowListScreen from '../screens/FollowListScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import FAQScreen from '../screens/FAQScreen';
import RanksInfoScreen from '../screens/RanksInfoScreen';

export type RootStackParamList = {
  MainTabs: undefined;
  Messages: undefined;
  Chat: { userId: string };
  Settings: undefined;
  Search: undefined;
  FollowList: { userId?: string; initialTab?: 'followers' | 'following' };
  UserProfile: { userId: string };
  Leaderboard: undefined;
  FAQ: undefined;
  RanksInfo: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen name="Messages" component={MessagesScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="FollowList" component={FollowListScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Stack.Screen name="FAQ" component={FAQScreen} />
      <Stack.Screen name="RanksInfo" component={RanksInfoScreen} />
    </Stack.Navigator>
  );
}
