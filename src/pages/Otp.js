import React from "react";
import { useState } from "react";
import { StyleSheet, Text, View, SafeAreaView, TextInput } from "react-native";
import { Globalstyles } from "../Styles/globalstyles";
import ButtonComp from "../components/ButtonComp";
import axios from 'axios';


const Otp = ({ navigation }) => {
  const otp = () => {
    navigation.navigate("Otp");
  };
  const Home = () => {
    navigation.navigate("Main");
  };
  const [verificationCode, setverificationCode] = useState({});
  const vcode = {
    verificationCode : verificationCode
  }
  const baseUrl = `http://192.168.1.118:8000/api/v1/user`;

  const headers = {
    "Content-Type": "application/json",
    'Accept': "*/*",
    "Cache-Control": "no-cache",
    'Connection': "keep-alive",
    'Postman-Token': 've5465yrter546576879768uyt6756t3435'
  };

  function createAcct(){
    axios
      .post(
        `${baseUrl}/register`,
        vcode,
        {
          headers : headers
        }
      )
      .then((res) => {
        console.log(res)
        console.log('connection success')
        navigation.navigate("Main");
      })
      .catch(e => { // catch should be in lowercase
        console.log('Failed to create Account', e);
      });
  }

  return (
    <View style={Globalstyles.form}>
      <SafeAreaView>
        <View style={styles.layout}>
          <View style={styles.headerCon}>
            <Text style={styles.header}>Email has been sent!</Text>
            <Text style={styles.headerTxt}>
              Please check your inbox and enter your verification code
            </Text>
          </View>
          <View style={styles.inputCon}>
            <TextInput
              style={styles.input}
              maxLength="4"
              value={verificationCode}
              onChangeText={(text)=>{setverificationCode(text)}}
              keyboardType="numeric"
            />
          </View>
          <View>
            <Text style={{ color: "#908A8A", textAlign: "center" }}>
              Code expires in <Text>03:33</Text>
            </Text>
          </View>
          <View style={styles.btnCon}>
            <ButtonComp text="Verify" next={createAcct} />
            <Text style={{ color: "#908A8A" }}>
              Didn't receive the code?{" "}
              <Text style={{ color: "#CF833F" }}>Resend</Text>
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

export default Otp;
