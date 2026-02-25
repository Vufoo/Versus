import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { typography } from '../constants/theme';
import { useTheme } from '../theme/ThemeProvider';
import HomeScreen from '../screens/HomeScreen';
import PlanMatchScreen from '../screens/PlanMatchScreen';
import VersusScreen from '../screens/VersusScreen';
import MapScreen from '../screens/MapScreen';
import ProfileScreen from '../screens/ProfileScreen';

export type TabParamList = {
  Home: undefined;
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
        tabBarLabel: ({ focused }) => (
          <TabLabel focused={focused} label={route.name} colors={colors} />
        ),
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home-outline';
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          if (route.name === 'Plan') iconName = focused ? 'calendar' : 'calendar-outline';
          if (route.name === 'Versus') iconName = focused ? 'flash' : 'flash-outline';
          if (route.name === 'Map') iconName = focused ? 'location' : 'location-outline';
          if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Feed' }}
      />
      <Tab.Screen
        name="Plan"
        component={PlanMatchScreen}
        options={{ title: 'Plan match' }}
      />
      <Tab.Screen
        name="Versus"
        component={VersusScreen}
        options={{ title: 'Versus' }}
      />
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{ title: 'Map' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 11,
    fontWeight: '500',
  },
});
