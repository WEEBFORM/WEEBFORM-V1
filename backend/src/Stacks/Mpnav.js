import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Marketplace from '../pages/Marketplace';
import MPMore from '../pages/MPMore';
import PPMore from '../pages/PPMore';

const Stack = createNativeStackNavigator();

const Mpnav = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Marketplace" component={Marketplace} options={{
        headerShown: false
      }} />
      <Stack.Screen name="More Marketplace" component={MPMore}  options={{
        headerShown: false
      }}  />
      <Stack.Screen name="Popular Marketplace" component={PPMore}  options={{
        headerShown: false
      }}  />
    </Stack.Navigator>
  );
};

export default Mpnav;
