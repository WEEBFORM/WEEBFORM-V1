import React from "react";
import { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  Image,
  TextInput,
} from "react-native";
import ButtonComp from "../components/ButtonComp";
import { Globalstyles } from "../Styles/globalstyles";
import axios from "axios";
import { login } from "../api/auth";

const Login = ({ navigation }) => {
  const create = () => {
    navigation.navigate("Create");
  };
  const forgot = () => {
    navigation.navigate("Forgot your password");
  };
  const Otp = () => {
    navigation.navigate("Otp");
  };
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const userData = {
    email: email,
    password: password
  }
  console.log(userData)
  
 async function loginAcct(){
  await login(userData, navigation)
  }
  

  return (
    <View style={Globalstyles.form}>
      <SafeAreaView>
        <View style={styles.layout}>
          <View style={styles.header}>
            <Image source={require("../assets/logo2.png")} />
            <Text style={Globalstyles.formHeader}>Login to Your Account</Text>
          </View>
          <View style={styles.mainform}>
            <View style={styles.inputCon}>
              <TextInput
                placeholderTextColor="#B1B1B1"
                placeholder="Your email address"
                inputMode="email"
                textContentType="emailAddress"
                value={email}
                onChangeText={(text)=>{setEmail(text)}}
                style={Globalstyles.formInput}
              />
            </View>

            <View style={styles.inputCon}>
              <TextInput
                placeholderTextColor="#B1B1B1"
                placeholder="Password"
                textContentType="password"
                value={password}
                onChangeText={(text)=>{setPassword(text)}}
                style={Globalstyles.formInput}
              />
            </View>
          </View>
          <View style={styles.signupCon}>
            <ButtonComp text="Login" next={loginAcct} />
            <Text
              onPress={() => {
                forgot();
              }}
              style={{ color: "#CF833F" }}
            >
              Forgot your password?
            </Text>
            <Text
              onPress={() => {
                create();
              }}
              style={{ color: "#fff" }}
            >
              Don't have an account?{" "}
              <Text style={{ color: "#CF833F" }}>Sign up</Text>
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  layout: {
    gap: 0,
  },
  header: {
    alignItems: "center",
    marginTop: 30,
  },
  mainform: {
    gap: 15,
    marginTop: 50,
  },
  inputCon: {
    gap: 10,
  },
  signupCon: {
    gap: 15,
    alignItems: "center",
  },
});

export default Login;
