import React from 'react'
import { StyleSheet, Text, View,Image, SafeAreaView, ImageBackground} from "react-native";


const Textpost = () => {
  return (
    <View style={styles.layout}>
    <Image source={require('../assets/postInd.png')} style={styles.ind} />
        <View style={styles.top}>
        <View style={styles.topLeft}>
            <View>
                <Image style={styles.pfp} source={require('../assets/pfp.png')} />
            </View>
            <View style={styles.topMiddle}>
                <View>
                    <Text style={styles.text}>Shedrach</Text>
                    <Text style={styles.text}>@Shezzy</Text>
                </View>
                <View><Text style={styles.follow}>Follow</Text></View>
            </View>
            </View>
            <View><Image source={require('../assets/more.png')} /></View>
        </View>
        <View style={styles.middle}>
            <Text style={styles.maintext}>Give up bitch </Text>
        </View>
        <View style={styles.bottom}>
            <View><Image source={require('../assets/like.png')} /></View>
            <View><Image source={require('../assets/comment.png')} /></View>
            <View><Image source={require('../assets/repost.png')} /></View>
            <View><Image source={require('../assets/save.png')} /></View>
            <View><Image source={require('../assets/share.png')} /></View>
        </View>
    </View>
  )
}

const styles = StyleSheet.create({
    layout:{
        // marginTop: 20,
        position: 'relative'
    },
    ind:{
        position: 'absolute',
        left: -25,
        top: 15
    },
    top:{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        justifyContent: 'space-between',
        paddingVertical: 10
    },
    topLeft:{
        flexDirection: 'row',
        gap: 10
    },
    topMiddle:{
        flexDirection: 'row',
        gap: 20
    },
    pfp:{
        width: 60,
        height: 60,
        borderRadius: 50
    },
    text:{
        color: 'white',
        fontSize: 16,
        lineHeight: 22
    },
    follow:{
        color: '#CF833F',
        fontSize: 16,
        lineHeight: 22
    },
    maintext:{
        color: 'white',
        fontSize: 18,
        lineHeight: 22
    },
    middle:{
        paddingVertical: 5,
        // paddingHorizontal: 20
    }, 
    bottom:{
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 15
    }
})

export default Textpost