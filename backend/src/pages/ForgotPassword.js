import React, { useState } from 'react'
import { StyleSheet, Text, View, SafeAreaView, Image, TextInput, KeyboardAvoidingView, ScrollView, Platform } from "react-native";
import { Globalstyles } from '../Styles/globalstyles';
import ButtonComp from '../components/ButtonComp';
import { forgotPassword } from '../api/auth';
import Loading from '../components/Loading/Loading';

const ForgotPassword = ({navigation}) => {
    const [loading, setLoading] = useState(false)
    const [errorText, setErrorText] = useState('')
    const login = ()=>{
        navigation.navigate('Login')
    }
    const [fgPwd, setFgPwd] = useState()
    const data = {
        email : 'ogbonnashedrach8@gmail.com'
    }
    async function forgetPwd(){
    console.log('forget')
      setLoading(true);
      setErrorText('')
      setTimeout(async () => {
        try {
         await forgotPassword(data, navigation);
         setErrorText('Email sent successfully')
        } catch (error) {
          console.log("forgot pass failed", error);
          if(error.status===500){
            console.log('network error')
          }
        } finally {
          setLoading(false);
          setErrorText('Failed to connect. Please try again')
        }
    }, 3000);
     };

  return (
    <View style={Globalstyles.form}>
      <KeyboardAvoidingView
     behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
     style={{ flex: 1 }}
     >
      <SafeAreaView>
      <ScrollView>
      {
        loading && <Loading/>
      }
        <View style={{...styles.layout, opacity: loading ? '0.4': '1'}}>
            <View style={styles.headerCon}>
                <Text style={styles.header}>Forgot your password?</Text>
                <Text style={styles.headerTxt}>Enter your registered email below to receive password reset instructions</Text>
            </View>
            <View style={styles.imgCon}>
                <Image source={require('../assets/mailbox.png')} />
            </View>
            <View style={styles.inputCon}>
                <TextInput placeholderTextColor='#B1B1B1' placeholder='Your email address' inputMode='email' textContentType='emailAddress' require={true} style={Globalstyles.formInput} />
                <Text onPress={()=>login()} style={{color:'#908A8A'}}>Remember password? <Text style={{color:'#CF833F'}}>Login</Text></Text>
            </View>
            <Text style={styles.text} >{errorText}</Text>
            <View style={styles.btnCon}>
            <ButtonComp text='Send' next={forgetPwd} />
            </View>
        </View>
        </ScrollView>
    </SafeAreaView>
    </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
    layout:{
        gap: 10
    },
    headerCon:{
        alignItems: 'center',
        gap: 30
    },
    header:{
        fontSize: 30,
        color: '#908A8A'
    },
    headerTxt:{
        textAlign:'center',
        color: '#908A8A',
        fontSize: 18
    },
    imgCon:{
        alignItems: 'center'
    },
    inputCon:{
        padding: 15,
        gap: 10
    },
    btnCon:{
        alignItems: 'center',
    },
text: {
    color: 'white',
    textAlign: 'center',
    marginTop: 15,
    fontWeight: '800',
    padding: 15,
    borderRadius: 5,
    backgroundColor:'green'
},
})

export default ForgotPassword