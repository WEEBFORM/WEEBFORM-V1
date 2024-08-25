import React from 'react'
import {
    StyleSheet,
    Text,
    View,
    SafeAreaView,
    Image,
    TextInput,
    Che,
  } from "react-native";

const Sidebar = () => {
  return (
    <View style={styles.container}>
    <View style={styles.sec1}>
        <View>
            <Image source={require('./../assets/coverphoto.png')} style={styles.pfp} />
        </View>
        <View style={styles.sec1W}>
            <Text style={styles.text}>Shedrach</Text>
            <Text style={{...styles.text, color: '#D2D2D2', fontSize: '12'}}>(@ShedrachJitsu)</Text>
            <View style={styles.follw}>
                <Text style={styles.text}>2 Following</Text>
                <Text style={styles.text}>2 Followers</Text>
            </View>
        </View>
    </View>
    <View style={styles.sec2}>
        <View style={styles.sec2C}>
            <Image source={require('./../assets/homeL.png')}/>
            <Text style={{...styles.text, color: 'white', fontSize: '18px', fontWeight: '900'}}>Home</Text>
        </View>
        <View style={styles.sec2C}>
            <Image source={require('./../assets/genre.png')}/>
            <Text style={{...styles.text, color: 'white', fontSize: '18px', fontWeight: '900'}}>All Genres</Text>
        </View>
        <View style={styles.sec2C}>
            <Image source={require('./../assets/newss.png')}/>
            <Text style={{...styles.text, color: 'white', fontSize: '18px', fontWeight: '900'}}>News</Text>
        </View>
    </View>
    <View style={styles.sec3}>
        <View style={styles.sec3T}>
            <Image source={require('../assets/postInd.png')} style={styles.ind} />
            <Text style={{...styles.text, color: 'white', fontSize: '16px', fontWeight: '500'}}>My Library</Text>
        </View>
        <View style={styles.sec3O}>
        <View style={styles.sec2C}>
            <Image source={require('./../assets/newss.png')}/>
            <Text style={{...styles.text, color: 'white', fontSize: '18px', fontWeight: '400'}}>Anime & Manga list</Text>
        </View>
        <View style={styles.sec2C}>
            <Image source={require('./../assets/newss.png')}/>
            <Text style={{...styles.text, color: 'white', fontSize: '18px', fontWeight: '400'}}>Favourites</Text>
        </View>
        <View style={styles.sec2C}>
            <Image source={require('./../assets/reccomm.png')}/>
            <Text style={{...styles.text, color: 'white', fontSize: '18px', fontWeight: '400'}}>Reccommendations</Text>
        </View>
        <View style={styles.sec2C}>
            <Image source={require('./../assets/newss.png')}/>
            <Text style={{...styles.text, color: 'white', fontSize: '18px', fontWeight: '400'}}>Create Marketplace</Text>
        </View>
        </View>
    </View>
    <View style={styles.sec4}>
    <View style={styles.sec3T}>
            <Image source={require('../assets/postInd.png')} style={styles.ind} />
            <Text style={{...styles.text, color: 'white', fontSize: '16px', fontWeight: '500'}}>My Library</Text>
        </View>
        <View style={styles.sec3O}>
        <View style={styles.sec2C}>
            <Image source={require('./../assets/newss.png')}/>
            <Text style={{...styles.text, color: 'white', fontSize: '18px', fontWeight: '400'}}>Saved Posts</Text>
        </View>
        <View style={styles.sec2C}>
            <Image source={require('./../assets/newss.png')}/>
            <Text style={{...styles.text, color: 'white', fontSize: '18px', fontWeight: '400'}}>Hidden Posts</Text>
        </View>
        </View>
    </View>
    </View>
  )
}

const styles = StyleSheet.create({
    container:{
        position: 'absolute',
        top: '5%',
        left: '0%',
        // borderWidth: '1px',
        // borderColor: 'white',
        width: '75%',
        height: '105%',
        backgroundColor: '#101010',
        zIndex: '2',
        paddingTop: 10
    },
    text:{
        color: 'white'
    },
    sec1:{
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center',
        padding: 10,
        borderBottomWidth: '1px',
        borderColor: '#2D2A2A'
    },
    pfp:{
        borderWidth: '5px',
        borderColor: 'black',
        width: 80,
        height: 80,
        borderRadius: '100%',
      },
      sec1W:{
        flexDirection: 'column',
        gap: 1
      },
      follw:{
        flexDirection: 'row',
        gap: 15,
        marginTop: 10
      },
      sec2:{
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 15,
        padding: 10,
        paddingVertical: 30,
        borderBottomWidth: '1px',
        borderColor: '#2D2A2A'
      },
      sec2C:{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10
      },
      sec3:{
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 15,
        padding: 10,
        paddingVertical: 30,
        borderBottomWidth: '1px'
      },
      sec3T:{
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: -10
      },
      sec3O:{
        gap: 15,
        marginLeft: 10
      },
      sec4:{
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 15,
        padding: 10,
      }
})

export default Sidebar