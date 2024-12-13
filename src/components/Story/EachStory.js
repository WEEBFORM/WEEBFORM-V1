import React from 'react'
import { StyleSheet, Text, View, SafeAreaView, Image, ImageBackground} from "react-native";


const EachStory = ({name, pictures, viewed}) => {
  // use localstorage to store the viewed or not view  
  return (
    <View>
        <View style={styles.layout}>
        <Image style={viewed ? styles.imageCon :  styles.viewed } source={require('../../assets/story1.png')} />
        <Text style={styles.text}>
          {name}
        </Text>
        </View>
    </View>
  )
}

const styles = StyleSheet.create({
  layout:{
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 20,
  },
  imageCon:{
    borderWidth: 3,
    height: 60,
    width:60,
    borderColor: '#EB9E71',
    borderRadius:50
  },
  text:{
    color: 'white',
    textAlign: 'center'
  },
  viewed: {
    height: 60,
    width:60,
  }
})

export default EachStory