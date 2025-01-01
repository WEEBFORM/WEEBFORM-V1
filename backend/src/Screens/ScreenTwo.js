import React from "react";
import { StyleSheet, Text, View, SafeAreaView, ImageBackground, TouchableWithoutFeedback, Keyboard } from "react-native";
import { Globalstyles } from "../Styles/globalstyles";
import WelcomeTwo from "../pages/WelcomeTwo";

const ScreenTwo = ({navigation}) => {
  const next = ()=>{
    navigation.navigate('Welcome2')
  }
  return (
    <ImageBackground style={Globalstyles.ImageBg} source={require('../assets/bg2.png')} resizeMode="cover" >
    <View style={Globalstyles.welcomeOneCon}>
      <WelcomeTwo nav={navigation} next={next} />
    </View> 
    </ImageBackground> 
  )
}

export default ScreenTwo