import React, { useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, Image, TextInput, TouchableOpacity } from "react-native";
import ButtonComp from '../components/ButtonComp';
import { Globalstyles } from '../Styles/globalstyles';
import { launchImageLibrary } from 'react-native-image-picker';

const Username = () => {
  const [photo, setPhoto] = useState(null);

  const openImagePicker = () => {
    const options = {
      mediaType: 'photo',
      quality: 1,
    };

    launchImageLibrary(options, (response) => {
      if (response.didCancel) {
        console.log('User cancelled image picker');
      } else if (response.error) {
        console.log('ImagePicker Error: ', response.error);
      } else if (response.assets && response.assets.length > 0) {
        const selectedImage = response.assets[0];
        setPhoto(selectedImage.uri); 
      }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.top}>
        <Image source={require('./../assets/logo.png')} style={styles.image} />
      </View>
      <View style={styles.layout}>
        <View style={styles.headerCon}>
          <Text style={styles.headerTxt}>What will you like others to call you</Text>
          <TextInput 
            placeholderTextColor='#B1B1B1' 
            placeholder='Display name' 
            textContentType='text' 
            style={{...Globalstyles.formInput, borderRadius: 4, width: '100%'}}
          />
        </View>
        <View style={styles.headerCon}>
          <Text style={styles.headerTxt}>Select a profile picture</Text>
          <TouchableOpacity onPress={openImagePicker} style={{margin: 'auto'}}>
            <Image 
              source={photo ? { uri: photo } : require('./../assets/dummy.png')} 
              style={styles.profileImage} 
            />
          </TouchableOpacity>
        </View>
        <View style={styles.btnCon}>
          <ButtonComp text='Save and Continue'/>
        </View>
        <Text style={styles.headerTxt}>Skip</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container:{
    backgroundColor: 'black',
    flex: 1, 
  },
  top:{
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 30,
    marginBottom: 35
  },
  image:{
    objectFit: 'contain',
    width: 80,
    height: 80,
    marginLeft: 10 
  },
  layout:{
    gap: 10,
    paddingHorizontal: 30
  },
  headerCon:{
    alignItems: 'flex-start',
    gap: 20,
    marginBottom: 35
  },
  headerTxt:{
    textAlign:'center',
    color: 'white',
    fontSize: 18
  },
  profileImage: {
    borderRadius: 50,
    backgroundColor: '#000', // This provides a placeholder background color
    marginBottom: 10,
    marginTop: 30
  },
  btnCon:{
    alignItems: 'center',
    gap: 10,
    marginBottom: 40
  }
});

export default Username;
