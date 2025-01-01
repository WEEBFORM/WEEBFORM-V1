import React,{useRef, useEffect} from 'react'
import { View, SafeAreaView, Text, StyleSheet, Image, Animated } from "react-native";

const Loading = () => {
    const fadeAnim = useRef(new Animated.Value(0)).current; // Initial opacity value is 0

    useEffect(() => {
      const fadeInOut = () => {
        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]).start(() => fadeInOut()); // Restart the animation
      };
  
      fadeInOut(); // Start the animation
    }, [fadeAnim]);
  return (
    <View style={style.welcome} >
       <Animated.Image 
        style={[style.image, { opacity: fadeAnim }]} 
        source={require('./../../assets/logo2.png')} 
      />
    </View>
  )
}

const style = StyleSheet.create({
    welcome : {
        // width: '100px'
        position: 'absolute',
        top: '0',
        left: '0',
        right:'0',
        bottom: '0',
        width: '100%',
        height: '100%',
        zIndex: '40',
    },
    image:{
        objectFit: 'contain',
        width: 100,
        height: 100,
        margin: 'auto'
        
      },
})

export default Loading
