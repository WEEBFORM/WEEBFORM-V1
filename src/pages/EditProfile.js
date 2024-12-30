import React from 'react'
import {
    StyleSheet,
    Text,
    View,
    SafeAreaView,
    Image,
    TextInput,
    ScrollView,
  } from "react-native";

const EditProfile = () => {
  return (
   <SafeAreaView style={styles.container}>
    <View style={styles.top}>
    <View style={styles.topLeft}>
    <Image source={require('./../assets/cancel.png')} style={styles.image} />
    <View>
    <Text style={{...styles.text, fontWeight: 600, marginBottom: 2, fontSize: 16}}>Edit Profile</Text>
    <Text style={styles.text}>@guile</Text>
    </View>
    </View>
    <Text style={styles.text}>Save</Text>
    </View>
    <ScrollView>
    <View style={styles.btm}>
    <View>
        <View style={styles.labelCon}>
            <Text style={styles.text}>Profile cover</Text>
            <Text style={styles.edit}>Edit</Text>
        </View>
        <View>
        <Image source={require('./../assets/coverp.png')} style={styles.image} />
        </View>
    </View>
    <View>
        <View style={styles.labelCon}>
            <Text style={styles.text}>Profile picture</Text>
            <Text style={styles.edit}>Edit</Text>
        </View>
        <View>
        <Image source={require('./../assets/dummy.png')} style={{...styles.image, margin: 'auto'}} />
        </View>
    </View>
    <View style={{width: '100%', gap: 10}}>
        <View style={styles.formInputs}>
            <Text style={styles.label}>Username</Text>
            <TextInput 
            style={styles.input} 
      />
        </View>
        <View style={styles.formInputs}>
            <Text style={styles.label}>Display name</Text>
            <TextInput 
            style={styles.input} 
      />
        </View>
        <View style={styles.formInputs}>
            <Text style={styles.label}>INTRO(Bio)</Text>
            <TextInput 
            style={styles.input} 
      />
        </View>
        <View style={styles.formInputs}>
            <Text style={styles.label}>Country</Text>
            <TextInput 
            style={styles.input} 
      />
        </View>
        <View style={styles.formInputs}>
            <Text style={styles.label}>Date of Birth</Text>
            <TextInput 
            style={styles.input} 
      />
        </View>
    </View>
    </View>
    </ScrollView>
   </SafeAreaView>
  )
}
const styles = StyleSheet.create({
    container:{
      backgroundColor: 'black',
      flex: 1, 
    },
    text:{
        color: 'white'
    },
    top:{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 7,
        alignItems: 'center',
        borderWidth: 1,
        borderBottomColor: '#2C2B2B'
    },
    btm:{
        gap: 10
    },
    topLeft:{
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
        alignItems: 'center'
    },
    btm:{
        paddingHorizontal: 20,
        marginTop: 30,
        alignItems: 'center',
        gap: 30
    },
    labelCon:{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 5,
        width: '100%'
    },
    edit:{
        color: '#CF833F',
        fontSize: 16,
        fontWeight: 700
    },
    label:{
        color: '#7E7E7E',
        padding: 5,
        backgroundColor: 'black',
        zIndex: 20,
        width: 100,
        // transform: 'translate(10, 11)',
        textAlign: 'center',

    },
    input:{
        color: 'white',
        borderWidth: 1,
        borderColor: '#2C2B2B',
        padding: 10,
        paddingTop: 20,
        borderRadius: 5,
    }
  });

export default EditProfile
