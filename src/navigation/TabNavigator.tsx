import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../constants/theme';
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

function TabLabel({ focused, label }: { focused: boolean; label: string }) {
  return (
    <Text
      style={[
        styles.label,
        {
          color: focused ? colors.primary : colors.textSecondary,
        },
      ]}
    >
      {label}
    </Text>
  );
}

export default function TabNavigator() {
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
        tabBarLabel: ({ focused }) => <TabLabel focused={focused} label={route.name} />,
        tabBarIcon: ({ focused, color, size }) => {
          const iconSize = route.name === 'Versus' ? size + 6 : size;

          let iconName: keyof typeof Ionicons.glyphMap = 'home-outline';
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          if (route.name === 'Plan') iconName = focused ? 'calendar' : 'calendar-outline';
          if (route.name === 'Versus') iconName = focused ? 'flash' : 'flash-outline';
          if (route.name === 'Map') iconName = focused ? 'location' : 'location-outline';
          if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';

          const iconColor = route.name === 'Versus' && focused ? colors.textOnPrimary : color;

          if (route.name === 'Versus') {
            return (
              <View style={styles.centerIconWrapper}>
                <View style={[styles.centerIconCircle, focused && styles.centerIconCircleFocused]}>
                  <Ionicons name={iconName} size={iconSize} color={iconColor} />
                </View>
              </View>
            );
          }

          return <Ionicons name={iconName} size={iconSize} color={color} />;
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
  centerIconWrapper: {
    position: 'relative',
    top: -8,
  },
  centerIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  centerIconCircleFocused: {
    backgroundColor: colors.primary,
  },
});
