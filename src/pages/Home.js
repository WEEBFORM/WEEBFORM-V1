import React from 'react'
import { StyleSheet, Text, View,Image, SafeAreaView, ImageBackground, ScrollView, Platform} from "react-native";
import { Globalstyles } from '../Styles/globalstyles';
import Nav from '../components/Nav';
import TopNav from '../components/TopNav';
import Textpost from '../components/Textpost';
import Photopost from '../components/Photopost';
import Story from '../components/Story/Story';
import EachStory from '../components/Story/EachStory';
import Menu from '../components/Menu';
import PostOptions from '../components/PostOptions';
import Profile from './Profile';
import Communities from './communities/Communities';
import News from './NewSec';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Feed from '../components/Feed';
import Upload from './Upload';
import Marketplace from './Marketplace';
import Mpnav from '../Stacks/Mpnav';

const Tab = createBottomTabNavigator();


// const Feed = () =>{
//   return(
//     <View style={Globalstyles.Home}>
//         <TopNav/>
//         <Nav/>
//         <Photopost/>
//         {/* <Menu/> */}
//     </View>
//   )
// }

const Home = () => {
  return (
      <Tab.Navigator
         screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle:{
            backgroundColor:'black',
            borderTopColor: 'black',
            paddingVertical: 3,
            height: Platform.select({
              ios:70,
              android:50
            })
          }
         }}
         >
   <Tab.Screen name='Home' component={Feed} options={{
    tabBarIcon:({focused})=>{
      return <View style={styles.iconLayout}>
        <Image source={require('../assets/home.png')} resizeMode='contain' style={{
          tintColor: focused ? '#CF833F': 'white',
          width: Platform.select({
            ios:30,
            android:20
          })
        }} />
      </View>
    }
   }} />
     <Tab.Screen name="Communities" component={Communities} options={{
    tabBarIcon:({focused})=>{
      return <View style={styles.iconLayout}>
        <Image source={require('../assets/comm.png')} resizeMode='contain' style={{
          tintColor: focused ? '#CF833F': 'white',
          width: Platform.select({
            ios:30,
            android:20
          })
        }} />
      </View>
    }
   }} />
     <Tab.Screen name="Upload" component={Upload} options={{
    tabBarIcon:({focused})=>{
      return <View style={styles.iconLayout}>
        <Image source={require('../assets/upload.png')} resizeMode='contain' style={{
          tintColor: focused ? '#CF833F': 'white',
          width: Platform.select({
            ios:30,
            android:20
          })
        }} />
      </View>
    }
   }} />
     <Tab.Screen name="News" component={News} options={{
    tabBarIcon:({focused})=>{
      return <View style={styles.iconLayout}>
        <Image source={require('../assets/newss.png')} resizeMode='contain' style={{
          tintColor: focused ? '#CF833F': 'white',
          width: Platform.select({
            ios:30,
            android:20
          })
        }} />
      </View>
    }
   }}  />
     <Tab.Screen name="MarketplaceNav" component={Mpnav} options={{
    tabBarIcon:({focused})=>{
      return <View style={styles.iconLayout}>
        <Image source={require('../assets/shopping.png')} resizeMode='contain' style={{
          tintColor: focused ? '#CF833F': 'white',
          width: Platform.select({
            ios:30,
            android:20
          })
        }} />
      </View>
    }
   }}  />
    <Tab.Screen name="Profile" component={Profile} options={{
    tabBarIcon:({focused})=>{
      return <View style={styles.iconLayout}>
        <Image source={require('../assets/user.png')} resizeMode='contain' style={{
          tintColor: focused ? '#CF833F': 'white',
          width: Platform.select({
            ios:30,
            android:20
          })
        }} />
      </View>
    }
   }}  />
   </Tab.Navigator>
  )
}

const styles = StyleSheet.create({
    text:{
        color: 'white'
    },
    iconLayout: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
    }
})

export default Home