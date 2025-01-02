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

const WelcomeOne = ({next}) => {
  return (
    <SafeAreaView>
      <View  style={styles.layout}>
        <Text style={Globalstyles.welcomeTextHeader}>
          Welcome to <Text style={styles.weebform}>WeebForms</Text>
        </Text>
        <Text style={Globalstyles.welcomeText}>
          The best store & community app of the century to entertain you
          everyday
        </Text>
        <Image source={require('../assets/slide1.png')} />
        <ButtonComp text='Next' next = {next} />
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

export default WelcomeOne;
