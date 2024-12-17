import React from 'react'
import { StyleSheet, Text, View, SafeAreaView, ImageBackground, Image, Platform} from "react-native";


const TopNav = ({sidebar}) => {
  return (
    <View style={styles.layout}>
    <View style={styles.imagesCon}>
    <Image style={styles.images} source={require('../assets/logo.png')} />
    </View>
        <View style={styles.right}>
        <Image style={styles.navImg} source={require('../assets/notis.png')} />
        <Image style={styles.navImg} source={require('../assets/search.png')} />
        <View onTouchStart={sidebar}>
        <Image source={require('../assets/menu.png')}  />
        </View>
        </View>
    </View>
  )
}

const styles = StyleSheet.create({
    layout:{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: Platform.select({
            android: 20,
            ios: 0,
        })
    }, 
    right:{
        flexDirection: 'row',
        gap: 20,
        alignItems: 'center',
        marginRight: 15
    },
    imagesCon:{
        flex: 1,
        width: 10
    },
    images:{
        objectFit: 'contain',
        width: 80,
        height: 80
    },
    navImg: {
        width: Platform.select({
            android: 20,
            ios: 20,

          }),
          height: Platform.select({
            android: 20,
            ios: 20,

          }),
    }
})

export default TopNav