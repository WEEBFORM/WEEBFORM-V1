import React from 'react'
import { StyleSheet, Text, View, Image, SafeAreaView, ImageBackground} from "react-native";


const Menu = () => {
  return (
    <View style={styles.layout}>
        <Image source={require('../assets/home.png')} />
        <Image source={require('../assets/people.png')} />
        <Image source={require('../assets/add.png')} />
        <Image source={require('../assets/comm.png')} />
        <Image source={require('../assets/shopping.png')} />
    </View>
  )
}

const styles = StyleSheet.create({
  layout:{
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 3,
    backgroundColor: 'black',
    marginHorizontal: -25
    // borderColor: 'white'
  }
})

export default Menu