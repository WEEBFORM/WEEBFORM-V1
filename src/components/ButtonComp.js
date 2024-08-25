import React from 'react'
import { View, Button, StyleSheet } from 'react-native'
import { Globalstyles } from '../Styles/globalstyles'

const ButtonComp = ({text, next}) => {
  return (
    <View style={Globalstyles.buttonCon}>
    <Button style={styles.text} title={text} color='white' onPress={next} />
    </View>
  )
}

const styles = StyleSheet.create({
  text:{
    backgroundColor: 'black',
    borderRadius: 20
  }
})

export default ButtonComp