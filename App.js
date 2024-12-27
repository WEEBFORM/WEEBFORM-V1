// import { StatusBar } from "expo-status-bar";
import { StatusBar } from 'react-native';
import { StyleSheet, Text, View, SafeAreaView, ImageBackground, TouchableWithoutFeedback, Keyboard } from "react-native";
import Welcome from "./src/pages/Welcome";
import WelcomeOne from "./src/pages/WelcomeOne";
import WelcomeTwo from "./src/pages/WelcomeTwo";
import WelcomeThree from "./src/pages/WelcomeThree";
import CreateAcct from "./src/pages/CreateAcct"; 
import Login from "./src/pages/Login";
import ForgotPassword from "./src/pages/ForgotPassword";
import Otp from "./src/pages/Otp";
import ResetLink from "./src/pages/ResetLink";
import { Globalstyles } from "./src/Styles/globalstyles";
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Screenone from "./src/Screens/Screenone";
import ScreenTwo from "./src/Screens/ScreenTwo";
import ScreenThree from "./src/Screens/ScreenThree";
import Home from "./src/pages/Home";
import Textpost from "./src/components/Textpost";
import Photopost from "./src/components/Photopost";
import MPMore from "./src/pages/MPMore";
import Username from "./src/pages/Username";
import JoinCommunity from './src/pages/communities/join-community';
import PreJoin from './src/pages/communities/prejoin-community';
import GroupList from './src/pages/communities/prejoin-community/grouplist';
// import EditProfile from "./src/pages/EditProfile";

const Stack = createNativeStackNavigator()


export default function App() {
  console.log("firstlove");
  return (
    // <TouchableWithoutFeedback onPress={()=>{
    //   Keyboard.dismiss()
    // }}>
    <View style={Globalstyles.container}>
    <NavigationContainer>
    <StatusBar barStyle="light-content" translucent={true} backgroundColor="transparent" />
    <Stack.Navigator screenOptions={{
      headerStyle:{
        backgroundColor: 'transperent'
      }
    }}>
      <Stack.Screen name='Splash' component={Welcome} options={{
        title: 'Splash',
        headerStyle:{
          backgroundColor: 'transparent',
        },
        headerTintColor: 'white',
        headerShown: false,
        headerTransparent: true ,
        headerTitleStyle: {
          fontSize: 20
        }
      }} />
      <Stack.Screen name='Home' component={Screenone} options={{
        title: 'WEEBFORM',
        headerStyle:{
          backgroundColor: 'transparent',
        },
        headerTintColor: 'white',
        headerTransparent: true ,
        headerTitleStyle: {
          fontSize: 20
        }
      }} />
      <Stack.Screen name='Welcome1' component={ScreenTwo} options={{
        title: 'WEEBFORM',
        headerStyle:{
          backgroundColor: 'transparent',
        },
        headerTintColor: 'white',
        headerTransparent: true ,
        headerTitleStyle: {
          fontSize: 20
        },
        headerBackTitleVisible: false,
        headerBackVisible:false 
      }} />
      <Stack.Screen name='Welcome2' component={ScreenThree} options={{
        title: 'WEEBFORM',
        headerStyle:{
          backgroundColor: 'transparent',
        },
        headerTintColor: 'white',
        headerTransparent: true ,
        headerTitleStyle: {
          fontSize: 20
        },
        headerBackTitleVisible: false,
        headerBackVisible:false 
      }} />
      <Stack.Screen name='Create' component={CreateAcct} options={{
        title: 'Create an Account',
        headerStyle:{
          backgroundColor: 'transparent',
        },
        headerTintColor: 'white',
        headerTransparent: true ,
        headerTitleStyle: {
          fontSize: 20
        },
        headerBackTitleVisible: false,
        headerBackVisible:false 
      }} />
      <Stack.Screen name='Login' component={Login} options={{
        title: 'Login',
        headerStyle:{
          backgroundColor: 'transparent',
        },
        headerTintColor: 'white',
        headerTransparent: true ,
        headerTitleStyle: {
          fontSize: 20
        },
        headerBackTitleVisible: false,
        headerBackVisible:false 
      }} />
      <Stack.Screen name='Username' component={Username} options={{
        title: 'Username',
        headerStyle:{
          backgroundColor: 'transparent',
        },
        headerTintColor: 'white',
        headerTransparent: true , 
        headerTitleStyle: {
          fontSize: 20
        },
        headerBackTitleVisible: false,
        headerBackVisible:false 
      }} />
      <Stack.Screen name='Otp' component={Otp} options={{
        title: 'Verify',
        headerStyle:{
          backgroundColor: 'transparent',
        },
        headerTintColor: 'white',
        headerTransparent: true ,
        headerTitleStyle: {
          fontSize: 20
        },
        headerBackTitleVisible: false,
        headerBackVisible:false 
      }} />
      <Stack.Screen name='Forgot your password' component={ForgotPassword} options={{
        title: 'Forgot your password',
        headerStyle:{
          backgroundColor: 'transparent',
        },
        headerTintColor: 'white',
        headerTransparent: true ,
        headerTitleStyle: {
          fontSize: 20
        },
        headerBackTitleVisible: false,
        headerBackVisible:false 
      }} />
      <Stack.Screen name='Main' component={Home} options={{
        title: 'Main',
        headerStyle:{
          backgroundColor: 'transparent',
        },
        headerTintColor: 'white',
        headerTransparent: true ,
        headerShown: false,
        headerTitleStyle: {
          fontSize: 20
        },
        headerBackTitleVisible: false,
        headerBackVisible:false 
      }} />
      <Stack.Screen name='Forgotpasswordmail' component={ResetLink} options={{
        title: 'Forgotpasswordmail',
        headerStyle:{
          backgroundColor: 'transparent',
        },
        headerTintColor: 'white',
        headerTransparent: true ,
        headerShown: false,
        headerTitleStyle: {
          fontSize: 20
        },
        headerBackTitleVisible: false,
        headerBackVisible:false 
      }} />

<Stack.Screen name='JoinCommunity' component={JoinCommunity} options={{
        title: 'Forgotpasswordmail',
        headerStyle:{
          backgroundColor: 'transparent',
        },
        headerTintColor: 'white',
        headerTransparent: true ,
        headerShown: false,
        headerTitleStyle: {
          fontSize: 20
        },
        headerBackTitleVisible: false,
        headerBackVisible:false 
      }} />

<Stack.Screen name='PreJoin' component={PreJoin}  options={{
        title: 'Forgotpasswordmail',
        headerStyle:{
          backgroundColor: 'transparent',
        },
        headerTintColor: 'white',
        headerTransparent: true ,
        headerShown: false,
        headerTitleStyle: {
          fontSize: 20
        },
        headerBackTitleVisible: false,
        headerBackVisible:false 
      }}  />

<Stack.Screen name='GroupList' component={GroupList}  options={{
        title: 'Forgotpasswordmail',
        headerStyle:{
          backgroundColor: 'transparent',
        },
        headerTintColor: 'white',
        headerTransparent: true ,
        headerShown: false,
        headerTitleStyle: {
          fontSize: 20
        },
        headerBackTitleVisible: false,
        headerBackVisible:false 
      }}  />
      {/* <Stack.Screen name='EditProfile' component={EditProfile} options={{
        title: 'Edit Profile',
        headerStyle:{
          backgroundColor: 'black',
        },
        headerTintColor: 'white',
        headerTransparent: true ,
        headerShown: false,
        headerTitleStyle: {
          fontSize: 20
        },
        headerBackTitleVisible: false,
        headerBackVisible:false 
      }} /> */}

    </Stack.Navigator>
   
      {/* </NavigationContainer> */}
      {/* <Home/> */}
      </NavigationContainer>
    </View>
    // </TouchableWithoutFeedback>
    
  );
}
