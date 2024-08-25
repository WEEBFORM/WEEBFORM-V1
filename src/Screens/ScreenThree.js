import React from "react";
import { StyleSheet, Text, View, SafeAreaView, ImageBackground, TouchableWithoutFeedback, Keyboard } from "react-native";
import { Globalstyles } from "../Styles/globalstyles";
import WelcomeThree from "../pages/WelcomeThree";

const ScreenThree = ({navigation}) => {
  const next = ()=>{
    navigation.navigate('Login')
  }
  return (
    <ImageBackground style={Globalstyles.ImageBg} source={require('../assets/bg2.png')} resizeMode="cover" >
    <View style={Globalstyles.welcomeOneCon}>
      <WelcomeThree next={next} />
    </View> 
    </ImageBackground> 
  )
}

export default ScreenThree