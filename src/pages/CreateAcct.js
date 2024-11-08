import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  Image,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  Platform
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
const [errorText, setErrorText] = useState('')
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
    setLoading(true)
    setErrorText('')
    setTimeout(async () => {
      navigation.navigate('Forgot your password')
      try {
        await createAcct(userData, navigation)
      } catch (error) {
        console.log("Login failed:", error);
        if(error.status===500){
          console.log('network error')
        }
      } finally {
        setLoading(false);
        setErrorText('Failed to create account. Please try again')
      }
    }, 3000);
  }
  
  const login = () => {
    navigation.navigate("Login");
  };
  return (
    <View style={Globalstyles.form}>
      <KeyboardAvoidingView
       behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
       style={{ flex: 1 }}>
      <SafeAreaView>
      <ScrollView>
      {loading && <Loading/>}
        <View style={{...styles.layout, opacity: loading ? '0.4': '1'}}>
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
          <View>
            <Text style={styles.text} >{errorText}</Text>
          </View>
          <View style={styles.signupCon}>
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
        </ScrollView>
      </SafeAreaView>
      </KeyboardAvoidingView>
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
  text:{
    color:'white',
    textAlign:'center',
    marginTop: 20,
    fontWeight:'800',
    color:'#FF0808'
  }
});

export default CreateAcct;
