import React from "react";
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  Image,
  TextInput,
  Che,
  TouchableOpacity,
} from "react-native";
import GapComponent from "../components/gap-component";
import { useNavigation } from "@react-navigation/native";

const Profile = () => {
  const navigation = useNavigation()
  return (
    <View style={styles.container}>
    <View style={styles.top}>
      <Image source={require('./../assets/coverphoto.png')} style={styles.coverphoto} />
    </View>
    <View style={styles.pfpCon}>
    <Image source={require('./../assets/coverphoto.png')} style={styles.pfp} />
    <Text style={{...styles.text, fontWeight: 800, fontSize:24}}>Gullibeeman</Text>
    <Text style={{...styles.text, fontWeight: 400, fontSize:20}}>@gullie</Text>
    </View>
    <View style={styles.bottom}>
      <View style={styles.bio}>
        <Text style={{...styles.text, fontWeight: 800, fontSize:18}}>Anime freek</Text>
      </View>
      <View style={styles.stats}>
        <View style={styles.eachStats}>
          <Text style={{...styles.text, fontWeight: 800, fontSize:18}}>5.7K</Text>
          <Text style={{...styles.text, fontWeight: 500, fontSize:14}}>Following</Text>
        </View>
        <View style={styles.eachStats}>
          <Text style={{...styles.text, fontWeight: 800, fontSize:18}}>240</Text>
          <Text style={{...styles.text, fontWeight: 500, fontSize:14}}>Followers</Text>
        </View>
        <View style={styles.eachStats}>
          <Text style={{...styles.text, fontWeight: 800, fontSize:18}}>7K</Text>
          <Text style={{...styles.text, fontWeight: 500, fontSize:14}}>Posts</Text>
        </View>
        <View style={styles.eachStats}>
          <Text style={{...styles.text, fontWeight: 800, fontSize:18}}>567</Text>
          <Text style={{...styles.text, fontWeight: 500, fontSize:14}}>Comments</Text>
        </View>
      </View>

      <GapComponent height={20} />
    <TouchableOpacity
    onPress={() => navigation.navigate('EditProfile')}
              style={{
                backgroundColor: "#CF833F",
                width: "90%",
                height: 63,
                borderRadius: 35,
                padding: 10,
                alignItems: "center",
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              <Text
                style={{
                  textAlign: "center",
                  marginTop: "auto",
                  marginBottom: "auto",
                  fontSize: 16,
                  fontWeight: "600",
                }}
              >
               Edit Profile
              </Text>
            </TouchableOpacity>
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
    height: '30%'
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
    borderWidth: 5,
    borderColor: 'black',
    width: 200,
    height: 200,
    borderRadius: 100,
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
    borderRightWidth: 2,
    borderColor: '2C2B2B'
  }
})

export default Profile;
