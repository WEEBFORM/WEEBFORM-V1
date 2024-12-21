import React, { useEffect } from "react";
import { View, SafeAreaView, Text, StyleSheet, Image } from "react-native";
import { Globalstyles } from "../Styles/globalstyles";
import * as Keychain from 'react-native-keychain';
import * as SecureStore from 'expo-secure-store';

const Welcome = ({navigation}) => {
  async function getToken(){
    try{
      // const credentials = await SecureStore.getItemAsync("Token");
      const credentials = false
      console.log(credentials)
      return credentials
    }catch(e){
      console.log(e)
    }
  }

  useEffect(()=>{
      setTimeout(async()=>{
      // const token = await getToken()
      const token = true
        if(token){
          navigation.navigate('Main')
        }else{
          navigation.navigate('Main')
        }
        }, 3000)
  }, [])
  return ( 
         <SafeAreaView style={style.welcome}>
         <Image source={require('../assets/logo.png')} style={style.image}/>
        {/* <Text>Welcome</Text> */}
    </SafeAreaView>
  );
};

const style = StyleSheet.create({
    welcome : {
        flex: 1,
        backgroundColor: '#CF833F', 
        alignItems: 'center',
        // border: '2 solid black',
        // backgroundColor: '#A54A15',
        justifyContent: 'center'
    },
    image: {
      
    }
})

export default Welcome;
