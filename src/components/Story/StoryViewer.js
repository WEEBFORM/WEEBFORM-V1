import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Image,
  Text,
  ImageBackground,
  TextInput,
  TouchableOpacity,
} from "react-native";
import GestureRecognizer from "react-native-swipe-gestures";

const StoryViewer = ({ route, navigation }) => {
  const { storyData, currentIndex } = route.params;
  const [index, setIndex] = useState(currentIndex);
  const fruit = require("../../assets/fruit.png");
  const share = require("../../assets/sharebox.png");

  const onSwipeLeft = () => {
    if (index < storyData.length - 1) {
      setIndex(index + 1);
    } else {
      navigation.goBack(); // Exit viewer if on the last story
    }
  };

  const onSwipeRight = () => {
    if (index > 0) {
      setIndex(index - 1);
    } else {
      navigation.goBack(); // Exit viewer if on the first story
    }
  };

  return (
    <GestureRecognizer
      onSwipeLeft={onSwipeLeft}
      onSwipeRight={onSwipeRight}
      style={styles.container}
    >
      <ImageBackground style={styles.image} source={storyData[index].pictures}>
        {/* <Text style={styles.text}>{storyData[index].name}</Text> */}
     
        <View
        style={{
          backgroundColor: "#060606",
          height: "8%",
          width: "100%",
          
          flexDirection: "row",
          position: 'absolute',
        bottom: 0,
          paddingVertical: 26,
          paddingHorizontal: 12,

          gap: 2,
          alignItems: "center",
        }}
      >
        <TextInput
          placeholder="Reply"
          placeholderTextColor={"#3B3B3B"}
          style={{
            backgroundColor: "#080808",
            width: "80%",
            borderRadius: 24,
            padding: 6,
            height: 38,
            color: "#fff",
          }}
        />

        <TouchableOpacity
          style={{
            height: 23,
            width: 31,
            borderRadius: 5,
            backgroundColor: "#101010",
            alignItems: "center",
          }}
        >
          <Image source={fruit} style={{ height: 17, width: 17 }} />
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            height: 23,
            width: 31,
            borderRadius: 5,
            backgroundColor: "#101010",
            alignItems: "center",
          }}
        >
          <Image source={share} style={{ height: 17, width: 17 }} />
        </TouchableOpacity>
      </View>
      </ImageBackground>
   
    </GestureRecognizer>
  );
};

const styles = StyleSheet.create({
  container: {
    // flex: 1,
    backgroundColor: "#060606",
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  text: {
    color: "white",
    marginTop: 20,
    fontSize: 16,
  },
});

export default StoryViewer;
