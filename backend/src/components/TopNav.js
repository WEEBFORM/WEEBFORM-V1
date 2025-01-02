import React from 'react'
import { StyleSheet, Text, View, SafeAreaView, ImageBackground, Image} from "react-native";


const TopNav = ({sidebar}) => {
  return (
    <View style={styles.layout}>
    <View style={styles.imagesCon}>
    <Image style={styles.images} source={require('../assets/logo.png')} />
    </View>
        <View style={styles.right}>
        <Image source={require('../assets/notis.png')} />
        <Image source={require('../assets/search.png')} />
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
})

export default TopNav