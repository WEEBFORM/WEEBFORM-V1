import { useNavigation } from "@react-navigation/native";
import React from "react";
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ImageBackground,
  Image,
  Platform,
  TouchableOpacity,
} from "react-native";

const TopNav = ({ sidebar }) => {
    const navigation = useNavigation()
  return (
    <View style={styles.layout}>
      <View style={styles.imagesCon}>
        <Image style={styles.images} source={require("../assets/logo.png")} />
      </View>
      <View style={styles.right}>
        <TouchableOpacity onPress={() => navigation.navigate('NotificationPage')}>
          <Image
            style={styles.navImg}
            source={require("../assets/notification.png")}
          />
        </TouchableOpacity>
        <TouchableOpacity >
          <Image
            style={styles.navImg}
            source={require("../assets/search.png")}
          />
        </TouchableOpacity>
        <View onTouchStart={sidebar}>
          <Image source={require("../assets/menu.png")} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  layout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Platform.select({
      android: 20,
      ios: 0,
    }),
  },
  right: {
    flexDirection: "row",
    gap: 20,
    alignItems: "center",
    marginRight: 15,
  },
  imagesCon: {
    flex: 1,
    width: 10,
  },
  images: {
    objectFit: "contain",
    width: 80,
    height: 80,
  },
  navImg: {
    width: Platform.select({
      android: 20,
      ios: 20,
    }),
    height: Platform.select({
      android: 20,
      ios: 20,
    }),
  },
});

export default TopNav;
