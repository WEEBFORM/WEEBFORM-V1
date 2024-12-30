import React from 'react'
import { StyleSheet, Text, View, SafeAreaView, Image, ImageBackground, TouchableOpacity} from "react-native";


const EachStory = ({name, pictures, viewed, onPress}) => {
  // use localstorage to store the viewed or not view  
  return (
  
        <TouchableOpacity onPress={onPress} style={styles.layout}>
        <Image style={viewed ? styles.viewed :  styles.imageCon } source={pictures} />
        <Text style={styles.text}>
          {name}
        </Text>
        </TouchableOpacity>
  
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
    // alignItems:'center',
    // justifyContent:"space-evenly",
    // marginTop: 'auto',
    // marginBottom: "auto",
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
    borderRadius:50
  }
})

export default EachStory