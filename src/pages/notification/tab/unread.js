import { View, Text, Image } from 'react-native'
import React from 'react'
import Container from '../../../components/ui/container'


const UnRead = () => {
const bell = require('../../../assets/bell.png')
  return (
    <View style={{
      
      
      height: '80%',
      width: '100%'
    }}>
   <View  style={{
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
    marginBottom: 'auto',

   }}
   
   >
    <Image source={bell} style={{
      height: 120,
      width:120,
      
    }} />
    <Text style={{
      color: '#A4A4A4',
      fontSize: 12,
      fontWeight: "400"
    }}>You dont have unread notification</Text>

   </View>
    </View>
  )
}

export default UnRead