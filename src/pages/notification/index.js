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
import RBSheet from "react-native-raw-bottom-sheet";
import GapComponent from "../../components/gap-component";
import { ms } from "react-native-size-matters";

const NotificationPage = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const source = require("../../assets/options.png");
  const navigation = useNavigation();
  const pagerRef = useRef(null);
  const optionSheetRef = useRef(null);
  const handleOptionsPress = () => {
    optionSheetRef.current?.open();
  };

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
        
          <Text
            style={[
              styles.tabLabel,
              activeIndex === index && styles.activeLabel,
            ]}
          >{route.title}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderContent = () => {
    if (activeIndex === 0) {
      return <AllTab />;
    }
    if (activeIndex === 1) {
      return <UnRead />;
    }
    return null;
  };


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
                gap:7,
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
              {/* <PagerView
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
              </PagerView> */}
            </View>


            <TouchableOpacity onPress={() => handleOptionsPress()}>
              <Image style={JoinCommunityStyles.image} source={source} />
            </TouchableOpacity>
          </View>
        </Container>

        <Container>
          {/* components */}
          {renderContent()}
        </Container>
      </Canvas>
      <RBSheet
        ref={optionSheetRef}
        height={184}
        openDuration={250}
        customStyles={{
          container: {
            backgroundColor: "#121212",
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
          },
        }}
      >
        <GapComponent height={ms(28)} />
        <Container>
          <View
            style={{
              height: 106,
              width: "100%",
              backgroundColor: "#3B3B3B",
              borderRadius: 12,
              padding: 12,
              // gap:20,
              justifyContent: "space-evenly",
            }}
          >
            <TouchableOpacity>
              <Text
                style={{
                  color: "#D9D9D9",
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                Mark all as read
              </Text>
            </TouchableOpacity>
            <View
              style={{
                width: "100%",
                height: 1,
                backgroundColor: "#131313",
              }}
            ></View>
            <TouchableOpacity>
              <Text
                style={{
                  color: "#E32D2D",
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                Delete all notifications{" "}
              </Text>
            </TouchableOpacity>
          </View>
        </Container>
      </RBSheet>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    
    alignItems: 'center',
    textAlign: 'center',
    // paddingVertical: 10,
    // borderBottomWidth: 1,
    gap:8,
    borderColor: "#7876764D",
  },
  tabButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
    borderRadius: 24,
    justifyContent:'center',
    backgroundColor: "#060606",
    paddingHorizontal:16,
    paddingVertical: 8,

    
  },
  activeTab: {
    // borderBottomWidth: 2,
    // borderColor: "#CF833F",
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
    marginRight: 'auto',
    marginLeft: 'auto',
    // textAlign: 'center',
    // alignItems:'center',
  },
  activeLabel: {
    color: "#CF833F",
  },
});
export default NotificationPage;
