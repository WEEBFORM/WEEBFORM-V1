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

const WelcomeThree = ({next}) => {
  return (
    <SafeAreaView>
      <View  style={styles.layout}>
        <Text style={Globalstyles.welcomeTextHeader}>
          Connect with <Text style={styles.weebform}>Weebs</Text>
        </Text>
        <Text style={Globalstyles.welcomeText}>
        Get acquainted with fellow weebs and explore what we have for you
        </Text>
        <Image source={require('../assets/slide3.png')} />
        <ButtonComp text= 'Get Started' next={next} />
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

export default WelcomeThree;
