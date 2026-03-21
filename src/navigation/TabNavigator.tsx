import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { typography } from '../constants/theme';
import { useTheme } from '../theme/ThemeProvider';
import { useLanguage } from '../i18n/LanguageContext';
import HomeScreen from '../screens/HomeScreen';
import PlanMatchScreen from '../screens/PlanMatchScreen';
import VersusScreen from '../screens/VersusScreen';
import MapScreen from '../screens/MapScreen';
import ProfileScreen from '../screens/ProfileScreen';

export type TabParamList = {
  Home: { scrollToMatchId?: string } | undefined;
  Plan: undefined;
  Versus: undefined;
  Map: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

function TabLabel({
  focused,
  label,
  colors,
}: {
  focused: boolean;
  label: string;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <Text
      style={[
        styles.label,
        { color: focused ? colors.primary : colors.textSecondary },
      ]}
    >
      {label}
    </Text>
  );
}

export default function TabNavigator() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: { ...typography.heading, color: colors.text },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 70,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabel: ({ focused }) => {
          const labelMap: Record<string, string> = {
            Home: t.tabs.feed,
            Plan: t.tabs.plan,
            Versus: t.tabs.versus,
            Map: t.tabs.map,
            Profile: t.tabs.profile,
          };
          return <TabLabel focused={focused} label={labelMap[route.name] ?? route.name} colors={colors} />;
        },
        tabBarIcon: ({ focused, color, size }) => {
          if (route.name === 'Versus') {
            return (
              <View style={[styles.versusBtn, { backgroundColor: colors.primary + '18' }]}>
                <Ionicons name="flash" size={22} color={colors.primary} />
              </View>
            );
          }
          let iconName: keyof typeof Ionicons.glyphMap = 'home-outline';
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          if (route.name === 'Plan') iconName = focused ? 'calendar' : 'calendar-outline';
          if (route.name === 'Map') iconName = focused ? 'location' : 'location-outline';
          if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: t.tabs.feed, headerShown: false }}
      />
      <Tab.Screen
        name="Plan"
        component={PlanMatchScreen}
        options={{ title: t.tabs.plan, headerShown: false }}
      />
      <Tab.Screen
        name="Versus"
        component={VersusScreen}
        options={{ title: t.tabs.versus, headerShown: false }}
      />
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{ title: t.tabs.map, headerShown: false }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: t.tabs.profile, headerShown: false }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 11,
    fontWeight: '500',
  },
  versusBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
