import React, { useState } from "react";
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
import { createAcct } from "../api/auth";
import Loading from "../components/Loading/Loading";

const CreateAcct = ({ navigation }) => {
const [username, setUsername] = useState('')
const [email, setEmail] = useState('')
const [password, setPassword] = useState('')
const [loading, setLoading] = useState(false)
console.log(username)

function toggleLoad(cond){
  setLoading(cond)
}
  
const userData = {
    username : username,
    password : password,
    email: email
}
console.log(userData)
  // const [data, setData] = useState();
  async function createNewAcct(){
    await createAcct(userData, navigation)
  }
  
  const login = () => {
    navigation.navigate("Login");
  };
  return (
    <View style={Globalstyles.form}>
      <SafeAreaView>
      {loading && <Loading/>}
        <View style={styles.layout}>
          <View style={styles.header}>
            <Image source={require("../assets/logo2.png")} />
            <Text style={Globalstyles.formHeader}>Create Your Account</Text>
          </View>
          <View style={styles.mainform}>
            <View style={styles.inputCon}>
              <TextInput
                placeholderTextColor="#B1B1B1"
                placeholder="@Username"
                value={username}
                onChangeText={(text)=>{setUsername(text)}}
                style={Globalstyles.formInput}
              />
              <Text style={styles.inputConText}>
                Between 2 to 15 characters
              </Text>
            </View>

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
              <Text style={styles.inputConText}>
                Between 2 to 15 characters
              </Text>
            </View>

            <View style={styles.inputCon}>
              <TextInput
                placeholderTextColor="#B1B1B1"
                placeholder="Choose password"
                textContentType="password"
                value={password}
                onChangeText={(text)=>{setPassword(text)}}
                style={Globalstyles.formInput}
              />
              <Text style={styles.inputConText}>
                Must be at least 6 characters
              </Text>
            </View>
            <View>
              <TextInput />
              <Text style={{ color: "#fff" }}>
                {" "}
                I agree to the terms and conditions
              </Text>
            </View>
          </View>
          <View style={styles.signupCon}>
          <View></View>
            <ButtonComp text="Sign up" next={createNewAcct} load={loading} toggleLoad={toggleLoad} />
            <Text
              onPress={() => {
                login();
              }}
              style={{ color: "#fff" }}
            >
              Alredy have an account?{" "}
              <Text style={{ color: "#CF833F" }}>Log in</Text>
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
    marginTop: 30,
  },
  inputCon: {
    gap: 10,
  },
  inputConText: {
    marginLeft: 10,
    color: "#CF833F",
  },
  signupCon: {
    gap: 15,
    alignItems: "center",
  },
});

export default CreateAcct;
