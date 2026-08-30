import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';

// Импорт экранов (будут созданы)
import DashboardScreen from '../screens/DashboardScreen';
import KnowledgeBaseScreen from '../screens/KnowledgeBaseScreen';
import InventoryScreen from '../screens/InventoryScreen';
import DailyReportScreen from '../screens/DailyReportScreen';
import NotesScreen from '../screens/NotesScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function DashboardStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="DashboardMain" 
        component={DashboardScreen}
        options={{ title: 'Панель управления' }}
      />
    </Stack.Navigator>
  );
}

function KnowledgeBaseStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="KnowledgeBaseMain" 
        component={KnowledgeBaseScreen}
        options={{ title: 'База знаний' }}
      />
    </Stack.Navigator>
  );
}

function InventoryStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="InventoryMain" 
        component={InventoryScreen}
        options={{ title: 'Склад' }}
      />
    </Stack.Navigator>
  );
}

function DailyReportStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="DailyReportMain" 
        component={DailyReportScreen}
        options={{ title: 'Отчет дня' }}
      />
    </Stack.Navigator>
  );
}

function NotesStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="NotesMain" 
        component={NotesScreen}
        options={{ title: 'Заметки' }}
      />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            switch (route.name) {
              case 'Dashboard':
                iconName = 'dashboard';
                break;
              case 'KnowledgeBase':
                iconName = 'book';
                break;
              case 'Inventory':
                iconName = 'inventory';
                break;
              case 'DailyReport':
                iconName = 'description';
                break;
              case 'Notes':
                iconName = 'note';
                break;
              default:
                iconName = 'circle';
            }

            return <MaterialIcons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#007AFF',
          tabBarInactiveTintColor: 'gray',
          headerShown: false,
        })}
      >
        <Tab.Screen name="Dashboard" component={DashboardStack} />
        <Tab.Screen name="KnowledgeBase" component={KnowledgeBaseStack} />
        <Tab.Screen name="Inventory" component={InventoryStack} />
        <Tab.Screen name="DailyReport" component={DailyReportStack} />
        <Tab.Screen name="Notes" component={NotesStack} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}