import React from 'react'
// import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Photopost from '../Photopost';
import People from '../../pages/People';
import Communities from '../../pages/Communities';
import Marketplace from '../../pages/Marketplace';

const Tab = createBottomTabNavigator();

const BottomNavigation = () => {
  return (
    <Tab.Navigator>
   <Tab.Screen name='Home' component={Photopost}/>
     <Tab.Screen name="People" component={People} />
     <Tab.Screen name="Communities" component={Communities} />
     <Tab.Screen name="Marketplace" component={Marketplace} />
   </Tab.Navigator>
  )
}

export default BottomNavigation