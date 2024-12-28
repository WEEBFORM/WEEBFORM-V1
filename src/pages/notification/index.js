import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import React, { useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import Canvas from "../../components/ui/canvas";
import Container from "../../components/ui/container";
import { Globalstyles } from "../../Styles/globalstyles";
import JoinCommunityStyles from "../communities/join-community/join-community.styles";
import Icon from "react-native-vector-icons/MaterialIcons";
import { StatusBar } from "expo-status-bar";
import { useNavigation } from "@react-navigation/native";
import PagerView from "react-native-pager-view";
import UnRead from "./tab/unread";
import AllTab from "./tab/allTab";

const NotificationPage = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const source = require("../../assets/options.png");
  const navigation = useNavigation();
  const pagerRef = useRef(null);

  const routes = [
    { key: "all", title: "All" },
    { key: "unread", title: "Unread" },
  ];

  const handleTabPress = (index) => {
    setActiveIndex(index);
    pagerRef.current?.setPage(index);
  };

  const renderTabBar = () => (
    <View style={styles.tabBarContainer}>
      {routes.map((route, index) => (
        <TouchableOpacity
          key={route.key}
          onPress={() => handleTabPress(index)}
          style={[styles.tabButton, activeIndex === index && styles.activeTab]}
        >
          <Image
            source={route.icon}
            style={[styles.icon, activeIndex === index && styles.activeIcon]}
          />
          <Text
            style={[
              styles.tabLabel,
              activeIndex === index && styles.activeLabel,
            ]}
          >
            {route.title}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar />
      <Canvas>
        <Container style={JoinCommunityStyles.navContainer}>
          <View style={JoinCommunityStyles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={JoinCommunityStyles.navIconContainer}
            >
              <Icon name={"arrow-back-ios"} color={"#FFFFFF"} size={22} />
            </TouchableOpacity>

            <View
              style={{
                width: 300,
                // backgroundColor: "red",
                height: 30,
                alignItems: "center",
                flexDirection: "row",
              }}
            >
              <Text
                style={{
                  color: "#FFFFFF",
                  fontWeight: "600",
                  fontSize: 20,
                }}
              >
                Notifications
              </Text>
              {renderTabBar()}
              <PagerView
                ref={pagerRef}
                style={{ flex: 1 }}
                initialPage={activeIndex}
                onPageSelected={(e) => setActiveIndex(e.nativeEvent.position)}
              >
                <View key="all">
                  <AllTab />
                </View>
                <View key="unread">
                  <UnRead />
                </View>
              </PagerView>
            </View>
            <TouchableOpacity>
              <Image style={JoinCommunityStyles.image} source={source} />
            </TouchableOpacity>
          </View>
        </Container>
      </Canvas>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#060606",
    paddingVertical: 10,
    borderBottomWidth: 1,
    // width:30, 
    borderColor: "#7876764D",
  },
  tabButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
    backgroundColor:'red'
  },
  activeTab: {
    borderBottomWidth: 2,
    borderColor: "#CF833F",
  },
  icon: {
    width: 20,
    height: 20,
    tintColor: "#888",
    marginBottom: 5,
  },
  activeIcon: {
    tintColor: "#CF833F",
  },
  tabLabel: {
    fontSize: 12,
    color: "#888",
  },
  activeLabel: {
    color: "#CF833F",
  },
});
export default NotificationPage;
