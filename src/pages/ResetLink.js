import React from "react";
import { useState } from "react";
import { StyleSheet, Text, View, SafeAreaView, TextInput } from "react-native";
import { Globalstyles } from "../Styles/globalstyles";
import ButtonComp from "../components/ButtonComp";
import axios from 'axios';


const ResetLink = ({ navigation }) => {
  const login = () => {
    navigation.navigate("Login");
  };

  return (
    <View style={Globalstyles.form}>
      <SafeAreaView>
        <View style={styles.layout}>
          <View style={styles.headerCon}>
            <Text style={styles.header}>Email has been sent!</Text>
            <Text style={styles.headerTxt}>
              Please check your inbox and follow the link to reset
              password
            </Text>
          </View>
        
          <View style={styles.btnCon}>
            <Text style={{ color: "#908A8A" }}>
              Didn't receive an inbox?{" "}
              <Text style={{ color: "#CF833F", fontSize: 20 }}>Resend</Text>
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  layout: {
    gap: 10,
  },
  headerCon: {
    alignItems: "center",
    gap: 30,
  },
  header: {
    fontSize: 30,
    color: "#908A8A",
  },
  headerTxt: {
    textAlign: "center",
    color: "#908A8A",
    fontSize: 18,
  },
  inputCon: {
    padding: 15,
    gap: 10,
  },
  btnCon: {
    alignItems: "center",
    gap: 10,
  },
  inputCon: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 40,
    width: 160,
    alignItems: "center",
    margin: "auto",
  },
  input: {
    borderBottomWidth: 1,
    paddingHorizontal: 30,
    paddingVertical: 25,
    borderRadius: 15,
    borderColor: "#EB9E71",
    color: "white",
    fontSize: 20,
    width: "100%",
    letterSpacing: 15,
  },
});

export default ResetLink;
