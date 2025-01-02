import React from "react";
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ImageBackground,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
  Button
} from "react-native";
import { Globalstyles } from "../Styles/globalstyles";
import WelcomeOne from "../pages/WelcomeOne";
import WelcomeTwo from "../pages/WelcomeTwo";
import WelcomeThree from "../pages/WelcomeThree";

const Screenone = ({navigation}) => {
  const next = ()=>{
    navigation.navigate('Welcome1')
  }
  return (
    <ImageBackground style={Globalstyles.ImageBg} source={require('../assets/bg1.png')} resizeMode="cover" >
    <View style={Globalstyles.welcomeOneCon}>
      <WelcomeOne nav={navigation} next={next} />
    </View>
      </ImageBackground>
  );
};

export default Screenone;
