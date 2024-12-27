import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import React, { useRef } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import GapComponent from "../../../components/gap-component";
import Icon from "react-native-vector-icons/MaterialIcons";
import { Image } from "react-native";
import Canvas from "../../../components/ui/canvas";
import { ms } from "react-native-size-matters";
import { useNavigation } from "@react-navigation/native";
import Container from "../../../components/ui/container";
import PreJoinStyles from "./prejoin.styles";
import RBSheet from "react-native-raw-bottom-sheet";

const GroupList = () => {
  const source = require("../../../assets/options.png");
  const profile = require("../../../assets/groupImg.png");
  const addGroup = require("../../../assets/addgroup.png");
  const community = require("../../../assets/community.png");
  const members = require("../../../assets/member.png");
  const navigation = useNavigation();
  const bottomSheetRef = useRef(null);
  const joinGroup = () => {
    bottomSheetRef.current?.open();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#070707" }}>
      <ScrollView>
        <Canvas>
          <Container style={PreJoinStyles.navContainer}>
            <View style={PreJoinStyles.header}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={PreJoinStyles.navIconContainer}
              >
                <Icon name={"arrow-back-ios"} color={"#FFFFFF"} size={22} />
              </TouchableOpacity>
              <View>
                <Text style={PreJoinStyles.title}>title</Text>
              </View>
              <TouchableOpacity>
                <Image style={PreJoinStyles.image} source={source} />
              </TouchableOpacity>
            </View>
          </Container>

          <Container style={{ backgroundColor: "#000" }}>
            <TouchableOpacity
              style={PreJoinStyles.groupsCont}
              onPress={() => navigation.navigate("GroupList")}
            >
              <View style={PreJoinStyles.imgCont}>
                <Image
                  source={profile}
                  style={{
                    width: 60,
                    height: 56,
                    borderWidth: 1,
                    borderRadius: 10,
                  }}
                />
                <View style={PreJoinStyles.groupCont}>
                  <Text
                    style={{
                      color: "#D9D9D9",
                      fontSize: 12,
                      fontWeight: "500",
                    }}
                  >
                    VINTAGEE
                  </Text>
                  <View style={{ flexDirection: "row", gap: 3 }}>
                    <Text
                      style={{
                        color: "#838383",
                        fontWeight: "300",
                        fontSize: 11,
                      }}
                    >
                      Community
                    </Text>
                    <Text
                      style={{
                        color: "#838383",
                        fontWeight: "300",
                        fontSize: 11,
                      }}
                    >
                      3 Groups
                    </Text>
                  </View>
                </View>
              </View>
              {/* <Icon name={"arrow-forward-ios"} color={"#838383"} size={22} /> */}
            </TouchableOpacity>
          </Container>

          <GapComponent height={14} />

          <Container
            style={{
              backgroundColor: "#070707",
              borderBottomWidth: 1,
              borderColor: "#2C2C2C4D",
            }}
          >
            <TouchableOpacity
              style={PreJoinStyles.groupsCont}
              onPress={() => navigation.navigate("GroupList")}
            >
              <View style={PreJoinStyles.imgCont}>
                <View style={PreJoinStyles.announceCont}></View>
                <View style={PreJoinStyles.groupCont}>
                  <Text
                    style={{
                      color: "#D9D9D9",
                      fontSize: 12,
                      fontWeight: "500",
                    }}
                  >
                    Announcements
                  </Text>
                  <View style={{ flexDirection: "row", gap: 3 }}>
                    <Text
                      style={{
                        color: "#838383",
                        fontWeight: "300",
                        fontSize: 11,
                      }}
                    >
                      You were added
                    </Text>
                    <Text
                      style={{
                        color: "#838383",
                        fontWeight: "300",
                        fontSize: 11,
                      }}
                    ></Text>
                  </View>
                </View>
              </View>
              <Text
                style={{
                  color: "#838383",
                  fontWeight: "300",
                  fontSize: 11,
                }}
              >
                7/08/4
              </Text>
            </TouchableOpacity>
          </Container>

          <GapComponent height={24} />

          <Container
            style={{
              backgroundColor: "#070707",
              borderBottomWidth: 1,
              borderColor: "#2C2C2C4D",
            }}
          >
            <Text
              style={{
                color: "#D9D9D9",
                fontSize: 12,
                fontWeight: "500",
              }}
            >
              Groups you're in
            </Text>
            <TouchableOpacity
              style={PreJoinStyles.groupsCont}
              onPress={() => navigation.navigate("GroupList")}
            >
              <View style={PreJoinStyles.imgCont}>
                <Image
                  source={profile}
                  style={{
                    width: 40,
                    height: 40,
                    borderWidth: 1,
                    borderRadius: 50,
                  }}
                />
                <View style={PreJoinStyles.groupCont}>
                  <Text
                    style={{
                      color: "#D9D9D9",
                      fontSize: 12,
                      fontWeight: "500",
                    }}
                  >
                    VINTAGEE CHAT
                  </Text>
                  <View style={{ flexDirection: "row", gap: 3 }}>
                    <Text
                      style={{
                        color: "#CF833F",
                        fontWeight: "300",
                        fontSize: 11,
                      }}
                    >
                      ~chidex is typing...
                    </Text>
                  </View>
                </View>
              </View>
              {/* <Icon name={"arrow-forward-ios"} color={"#838383"} size={22} /> */}
            </TouchableOpacity>
          </Container>
          <GapComponent height={24} />
          <Container
            style={{
              backgroundColor: "#070707",
              borderBottomWidth: 1,
              borderColor: "#2C2C2C4D",
            }}
          >
            <Text
              style={{
                color: "#838383",
                fontSize: 12,
                fontWeight: "500",
              }}
            >
              Groups you can join
            </Text>
            <TouchableOpacity
              style={PreJoinStyles.groupsCont}
              onPress={joinGroup}
            >
              <View style={PreJoinStyles.imgCont}>
                <Image
                  source={community}
                  style={{
                    width: 40,
                    height: 40,
                    borderWidth: 1,
                    borderRadius: 50,
                  }}
                />
                <View style={PreJoinStyles.groupCont}>
                  <Text
                    style={{
                      color: "#D9D9D9",
                      fontSize: 12,
                      fontWeight: "500",
                    }}
                  >
                    AMA time
                  </Text>
                  <View style={{ flexDirection: "row", gap: 3 }}>
                    <Text
                      style={{
                        color: "#838383",
                        fontWeight: "300",
                        fontSize: 13,
                      }}
                    >
                      Request to join
                    </Text>
                  </View>
                </View>
              </View>
              {/* <Icon name={"arrow-forward-ios"} color={"#838383"} size={22} /> */}
            </TouchableOpacity>
          </Container>
        </Canvas>
      </ScrollView>
      <RBSheet
        ref={bottomSheetRef}
        height={547}
        openDuration={250}
        customStyles={{
          container: {
            backgroundColor: "#121212",
            borderTopLeftRadius: 52,
            borderTopRightRadius: 52,
            borderTopWidth: 1,
            borderColor: "#CF833F",
          },
        }}
      >
        <GapComponent height={ms(48)} />
        <Container>
          <Container style={PreJoinStyles.displayInfoo}>
            <Image source={profile} style={PreJoinStyles.groupImage} />
            <Text style={PreJoinStyles.groupName}>Vintage Community</Text>
            <Text
              style={{
                color: "#D9D9D9",
                fontWeight: "300",
                fontSize: 24,
              }}
            >
              AMA Time
            </Text>
            <Text
              style={{
                color: "#838383",
                fontWeight: "300",
                fontSize: 15,
                marginTop: 5,
              }}
            >
              Created by Vintageee, 4/24/24
            </Text>

            <GapComponent height={ms(28)} />
            <Image
              source={members}
              style={{
                height: 41,
                width: 97,
              }}
            />
            <GapComponent height={ms(18)} />
            <Text
               style={{
                color: "#838383",
                fontWeight: "300",
                fontSize: 15,
                marginTop: 5,
              }}
            
            >An admin must approve your request</Text>
 <GapComponent height={ms(28)} />
            <TouchableOpacity
            style={{
                backgroundColor: '#EB9E71',
                padding: 10,
                alignItems: 'center',
                height: 46,
                width: '100%',
                borderRadius: 35,



            }}
            >
                <Text
                      style={{
                        color: "#101010",
                        fontWeight: "600",
                        fontSize: 15,
                        marginTop: 5,
                        textAlign: 'center',
                        
                      }}
                >
                    Request to join
                </Text>

            </TouchableOpacity>
          </Container>
        </Container>
      </RBSheet>
    </SafeAreaView>
  );
};

export default GroupList;
