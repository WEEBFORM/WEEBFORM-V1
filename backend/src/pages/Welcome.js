import React, { useEffect } from "react";
import { View, SafeAreaView, Text, StyleSheet, Image } from "react-native";
import { Globalstyles } from "../Styles/globalstyles";
import * as Keychain from 'react-native-keychain';
import * as SecureStore from 'expo-secure-store';

const Welcome = ({navigation}) => {
  async function getToken(){
    try{
      const credentials = await SecureStore.getItemAsync("Token");
      // const credentials = false
      return credentials
    }catch(e){
      console.log(e)
    }
  }

  useEffect(()=>{
      setTimeout(async()=>{
      const token = await getToken()
      console.log('checking token', token)
      // const token = true
        if(token){
          navigation.replace('Main')
        }else{
          navigation.replace('Home')
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
        border: '2px solid black',
        // backgroundColor: '#A54A15',
        justifyContent: 'center'
    },
    image: {
      
    }
})

export default Welcome;
