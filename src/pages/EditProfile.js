import React from 'react'
import { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    SafeAreaView,
    Image,
    TextInput,
    ScrollView,
    KeyboardAvoidingView,
    Platform
  } from "react-native";
  import { editProfile } from '../api/auth';
  import Loading from "../components/Loading/Loading";

const EditProfile = () => {
  const [loading, setLoading] = useState(false)
  const [errorText, setErrorText] = useState('')
    const [formData, setFormData] = useState({
        username: '',
        displayName: '',
        bio: '',
        country: '',
        dateOfBirth: ''
      });
    
      const handleChange = (name, value) => {
        console.log(formData)
        setFormData({ ...formData, [name]: value });
      };
    
      const handleSubmit = async () => {
        console.log('Form Submitting:', formData);
        setLoading(true);
        setErrorText('')
    setTimeout(async () => {
      try {
        await editProfile(formData);
      } catch (error) {
        console.log("failed to edit profile:", error);
        if(error.status===500){
          console.log('network error')
        }
      } finally {
        setLoading(false);
        setErrorText('Failed to connect. Please try again')
      }
    }, 2000);
      };
  return (
    <KeyboardAvoidingView
         behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
         style={{ flex: 1 }}>
   <SafeAreaView style={styles.container}>
    <View style={styles.top}>
    <View style={styles.topLeft}>
    <Image source={require('./../assets/cancel.png')} style={styles.image} />
    <View>
    <Text style={{...styles.text, fontWeight: 600, marginBottom: 2, fontSize: 16}}>Edit Profile</Text>
    <Text style={styles.text}>@guile</Text>
    </View>
    </View>
    <Text style={styles.text} onPress={handleSubmit}>Save</Text>
    </View>
    <ScrollView>
    {
        loading && <Loading/>
      }
    <View style={{...styles.btm,  opacity: loading ? '0.4': '1'}}>
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
            <Text style={styles.label}>Display name</Text>
            <TextInput
                  style={styles.input}
                  value={formData.username}
                  onChangeText={(value) => handleChange('username', value)}
                />
        </View>
        <View style={styles.formInputs}>
            <Text style={styles.label}>Username</Text>
            <TextInput 
            style={styles.input} 
            value={formData.displayName}
            onChangeText={(value) => handleChange('displayName', value)}
      />
        </View>
        <View style={styles.formInputs}>
            <Text style={styles.label}>INTRO(Bio)</Text>
            <TextInput
                  style={styles.input}
                  value={formData.bio}
                  onChangeText={(value) => handleChange('bio', value)}
                />
        </View>
        <View style={styles.formInputs}>
            <Text style={styles.label}>Country</Text>
            <TextInput
                  style={styles.input}
                  value={formData.country}
                  onChangeText={(value) => handleChange('country', value)}
                />
        </View>
        <View style={styles.formInputs}>
            <Text style={styles.label}>Date of Birth</Text>
            <TextInput
                  style={styles.input}
                  value={formData.dateOfBirth}
                  onChangeText={(value) => handleChange('dateOfBirth', value)}
                />
        </View>
    </View>
    </View>
    </ScrollView>
   </SafeAreaView>
   </KeyboardAvoidingView>
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
        zIndex: '20',
        width: 100,
        transform: 'translate(10px, 11px)',
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
