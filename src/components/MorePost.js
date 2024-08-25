import React from 'react'
import { StyleSheet, Text, View, SafeAreaView, ImageBackground, Image, FlatList} from "react-native";

const MorePost = ({show}) => {
  return (
    <View style={styles.layout}>
            <View style={styles.down}></View>
        <View style={styles.section}>
            <Text style={styles.text}>
                Save 
            </Text>
            <Image source={require('./../assets/save.png')} />
        </View>
        <View>
            <View style={styles.section}>
            <Text style={styles.text}>
                Unfollow 
            </Text>
            <Image source={require('./../assets/unfollow.png')} />
            </View>
            <View style={styles.section}>
            <Text style={styles.text}>
                Block 
            </Text>
            <Image source={require('./../assets/block.png')} />
            </View>
        </View>
        <View style={styles.section}>
        <Text style={{...styles.text, color: '#E32D2D'}}>
                Report Post
            </Text>
            <Image source={require('./../assets/report.png')} />
        </View>
    </View>
  )
}

const styles = StyleSheet.create({
    layout:{
        backgroundColor: '#121212',
        padding: 30,
        borderTopRightRadius: 30,
        borderTopLeftRadius: 30
    }, 
    text:{
        color: '#D9D9D9',
        fontSize: 18
    },
    section:{
        padding: 20,
        flexDirection: 'row',
        borderWidth: '6px',
        borderColor: '#121212',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#3B3B3B',
        borderRadius: 12
    },
    down:{
        borderWidth: 'white',
        height: 8,
        backgroundColor: '#3B3B3B',
        width: '30%',
        margin: 'auto',
        marginBottom: 30,
        borderRadius: 55
    }
  })

export default MorePost