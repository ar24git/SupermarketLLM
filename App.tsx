import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ChatScreen from './src/screens/ChatScreen';
import PriceTrackerScreen from './src/screens/PriceTrackerScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Chat">
        <Stack.Screen 
          name="Chat" 
          component={ChatScreen} 
          options={{ title: 'SupermarketLLM' }}
        />
        <Stack.Screen 
          name="PriceTracker" 
          component={PriceTrackerScreen} 
          options={{ title: 'Price Tracker' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
