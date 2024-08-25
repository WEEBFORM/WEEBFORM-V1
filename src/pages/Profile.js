import React from "react";
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  Image,
  TextInput,
  Che,
} from "react-native";

const Profile = () => {
  return (
    <View style={styles.container}>
    <View style={styles.top}>
      <Image source={require('./../assets/coverphoto.png')} style={styles.coverphoto} />
    </View>
    <View style={styles.pfpCon}>
    <Image source={require('./../assets/coverphoto.png')} style={styles.pfp} />
    <Text style={{...styles.text, fontWeight: '800', fontSize:'24px'}}>Gullibeeman</Text>
    <Text style={{...styles.text, fontWeight: '400', fontSize:'20px'}}>@gullie</Text>
    </View>
    <View style={styles.bottom}>
      <View style={styles.bio}>
        <Text style={{...styles.text, fontWeight: '800', fontSize:'18px'}}>Anime freek</Text>
      </View>
      <View style={styles.stats}>
        <View style={styles.eachStats}>
          <Text style={{...styles.text, fontWeight: '800', fontSize:'18px'}}>5.7K</Text>
          <Text style={{...styles.text, fontWeight: '500', fontSize:'14px'}}>Following</Text>
        </View>
        <View style={styles.eachStats}>
          <Text style={{...styles.text, fontWeight: '800', fontSize:'18px'}}>240</Text>
          <Text style={{...styles.text, fontWeight: '500', fontSize:'14px'}}>Followers</Text>
        </View>
        <View style={styles.eachStats}>
          <Text style={{...styles.text, fontWeight: '800', fontSize:'18px'}}>7K</Text>
          <Text style={{...styles.text, fontWeight: '500', fontSize:'14px'}}>Posts</Text>
        </View>
        <View style={styles.eachStats}>
          <Text style={{...styles.text, fontWeight: '800', fontSize:'18px'}}>567</Text>
          <Text style={{...styles.text, fontWeight: '500', fontSize:'14px'}}>Comments</Text>
        </View>
      </View>
      <View>
        <Text style={styles.text}></Text>
      </View>
    </View>
      <Text>Profile</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container:{
    backgroundColor: 'black',
    flex: 1, 
  },
  top:{
    height: '40%'
  }, 
  coverphoto:{
    width: '100%',
    height: '100%'
  },
  pfpCon:{
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: '-34%',
    marginBottom: '7%'
  },
  pfp:{
    borderWidth: '5px',
    borderColor: 'black',
    width: 200,
    height: 200,
    borderRadius: '100%',
  },
  text:{
    color: '#A4A4A4',
    // fontSize: 24
  },
  bottom:{
    flexDirection: 'column',
    gap: 15
  },
  bio:{
    backgroundColor: '#101010',
    padding: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20
  },
  stats:{
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#101010',
    borderRadius: 20,
  },
  eachStats:{
    width: '25%',
    alignItems: 'center',
    borderRightWidth: '2px',
    borderColor: '2C2B2B'
  }
})

export default Profile;
