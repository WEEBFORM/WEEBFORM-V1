import React from 'react'
import { SafeAreaView, View, Text, StyleSheet } from 'react-native'

const Header = () => {
  return (
    <SafeAreaView style={styless.container}>
        <Text>hello</Text>
    </SafeAreaView>
  )
}

const styless = StyleSheet.create({
    container:{
        flex: 1,
        color: 'red'
    }
})
export default Header