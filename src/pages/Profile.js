import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text, 
  View,
  SafeAreaView,
  Image,
  TextInput,
  Che,
  StatusBar
} from "react-native";
import { getUserData } from "../api/auth";
import Loading from "../components/Loading/Loading";
import { useNavigation } from "@react-navigation/native";
import { Buffer } from 'buffer';

const Profile = () => {
  const navigation = useNavigation()
  const [loading, setLoading] = useState(true)
  const [userData, setUserData] = useState([])
  async function getUserProfile() {
    try {
      const data = await getUserData();
      console.log(data)
      setUserData(data);
    } catch (error) {
      console.log("fetch profile failed:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=>{
    getUserProfile()
  },[])


  return (
    // <StatusBar barStyle="light-content" translucent={true} backgroundColor="transparent" />
    <View style={styles.container}>
    {
      loading ? <Loading/> : <>
    <View style={styles.top}>
    <Image
        source={{uri: userData.coverImage}}
        style={styles.coverphoto}
        resizeMode="cover"
        onError={(error) => console.error('Cover Image Error:', error.nativeEvent.error)}
      />
    </View>
    <View style={styles.pfpCon}>
    <Image source={{uri: userData.profilePic}} style={styles.pfp} />
    <Text style={{...styles.text, fontWeight: '800', fontSize:'24px'}}>{userData.full_name}</Text>
    <Text style={{...styles.text, fontWeight: '400', fontSize:'20px'}}>{userData.username}</Text>
    </View>
    <View style={styles.bottom}>
      <View style={styles.bio}>
        <Text style={{...styles.text, fontWeight: '800', fontSize:'18px'}}>{userData.bio}</Text>
      </View>
      <View style={styles.stats}>
        <View style={styles.eachStats}>
          <Text style={{...styles.text, fontWeight: '800', fontSize:'18px'}}>{userData.followingCount}</Text>
          <Text style={{...styles.text, fontWeight: '500', fontSize:'14px'}}>Following</Text>
        </View>
        <View style={styles.eachStats}>
          <Text style={{...styles.text, fontWeight: '800', fontSize:'18px'}}>{userData.followerCount}</Text>
          <Text style={{...styles.text, fontWeight: '500', fontSize:'14px'}}>Followers</Text>
        </View>
        <View style={styles.eachStats}>
          <Text style={{...styles.text, fontWeight: '800', fontSize:'18px'}}>{userData.postsCount}</Text>
          <Text style={{...styles.text, fontWeight: '500', fontSize:'14px'}}>Posts</Text>
        </View>
        <View style={styles.eachStats}>
          <Text style={{...styles.text, fontWeight: '800', fontSize:'18px'}}>567</Text>
          <Text style={{...styles.text, fontWeight: '500', fontSize:'14px'}}>Comments</Text>
        </View>
      </View>
      <View>
        <Text style={styles.text} onPress={()=>{
          navigation.navigate('Edit Profile')
        }}>Edit profile</Text>
      </View>
    </View>
      <Text>Profile</Text>
      </>
    }
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
    height: '100%',
  },
  pfpCon:{
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: '-34%',
    marginBottom: '7%'
  },
  pfp:{
    borderWidth: '2px',
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
