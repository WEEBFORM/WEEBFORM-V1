import React, { useState, useRef } from "react";
import { View, Text, Image, TouchableOpacity, Dimensions, StyleSheet, SafeAreaView } from "react-native";
import PagerView from "react-native-pager-view";
import Canvas from "../../components/ui/canvas";
import TopNav from "../../components/TopNav";
import Sidebar from "../../components/Sidebar";
import { Globalstyles } from "../../Styles/globalstyles";
import AllTab from "./tabs/all/all";
import ChatGroups from "./tabs/chat-group/chatGroup";
import PrivateChat from './tabs/private-chat/privateChat'

const { width } = Dimensions.get("window");

const CommunitiesScreen = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [sideBar, setSideBar] = useState(false)
  const pagerRef = useRef(null); 

  const routes = [
    { key: "all", title: "", icon: require("../../assets/all.png") },
    { key: "chatGroup", title: "Chat Groups", icon: require("../../assets/group.png") },
    { key: "privateChat", title: "Private Chats", icon: require("../../assets/private.png") },
  ];

  const handleTabPress = (index) => {
    setActiveIndex(index);
    pagerRef.current?.setPage(index); 
  };

  function openCloseSideBar(){
    setSideBar(!sideBar)
    console.log('sidebar')
  }


  const renderTabBar = () => (
    <View style={styles.tabBarContainer}>
      {routes.map((route, index) => (
        <TouchableOpacity
          key={route.key}
          onPress={() => handleTabPress(index)}
          style={[
            styles.tabButton,
            activeIndex === index && styles.activeTab, 
          ]}
        >
          <Image
            source={route.icon}
            style={[styles.icon, activeIndex === index && styles.activeIcon]}
          />
          <Text style={[styles.tabLabel, activeIndex === index && styles.activeLabel]}>
            {route.title}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={Globalstyles.Home}>
    <Canvas>
      {sideBar && <Sidebar />}
      <TopNav sidebar={openCloseSideBar} />

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
        <View key="chatGroup" >
  <ChatGroups />
        </View>
        <View key="privateChat">
      <PrivateChat />
        </View>
      </PagerView>
    </Canvas>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#060606",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#7876764D",
  },
  tabButton: {
    alignItems: "center",
    flexDirection: 'row',
    gap:2,
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

export default CommunitiesScreen;
