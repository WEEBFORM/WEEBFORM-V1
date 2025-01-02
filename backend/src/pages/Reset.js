import React from 'react'
import { StyleSheet, Text, View, SafeAreaView, Image, TextInput } from "react-native";
import ButtonComp from '../components/ButtonComp';
import { Globalstyles } from '../Styles/globalstyles';

const Reset = () => {
  return (
    <SafeAreaView>
    <View style={styles.layout}>
        <View style={styles.headerCon}>
            <Text style={styles.header}>Reset your password</Text>
            <Text style={styles.headerTxt}>Please enter your new password</Text>
        </View>
        <View style={styles.inputCon}>
        <TextInput placeholderTextColor='#B1B1B1' placeholder='New password' textContentType='password' style={Globalstyles.formInput}/>
        <TextInput placeholderTextColor='#B1B1B1' placeholder='Confirm new password' textContentType='password' style={Globalstyles.formInput}/>
        <Text style={{color:'#908A8A'}}>Your Password must contain: Min 8 characters, special symbol(@,.,#,!), Uppercase.  </Text>
        </View>
        <View style={styles.btnCon}>
        <ButtonComp text='Done'/>
        </View>
    </View>
</SafeAreaView>
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
    inputCon:{
        padding: 15,
        gap: 10,
        marginVertical: 50
    },
    btnCon:{
        alignItems: 'center',
        gap: 10
    }
})

export default Reset