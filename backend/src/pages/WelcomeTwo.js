import React from "react";
import {
  View,
  SafeAreaView,
  Text,
  StyleSheet,
  Image,
} from "react-native";
import { Globalstyles } from "../Styles/globalstyles";
import ButtonComp from "../components/ButtonComp";

const WelcomeTwo = ({next}) => {
  return (
    <SafeAreaView>
      <View  style={styles.layout}>
        <Text style={Globalstyles.welcomeTextHeader}>
          Find what <Text style={styles.weebform}>Interests</Text> You
        </Text>
        <Text style={Globalstyles.welcomeText}>
        Get the opportunity to connect with fellow Anime friends all over
        </Text>
        <Image source={require('../assets/slide2.png')} />
        <ButtonComp text='Next' next = {next}  />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  layout: {
    gap: 20,
    alignItems:'center'
  },
  weebform :{
    color: '#CF833F'
  }
});

export default WelcomeTwo;
