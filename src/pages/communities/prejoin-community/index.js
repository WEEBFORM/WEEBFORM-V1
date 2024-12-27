import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import GapComponent from "../../../components/gap-component";
import Icon from "react-native-vector-icons/MaterialIcons";
import { Image } from "react-native";
import Canvas from "../../../components/ui/canvas";
import { ms } from "react-native-size-matters";
import { useNavigation } from "@react-navigation/native";
import Container from "../../../components/ui/container";
import PreJoinStyles from "./prejoin.styles";

const PreJoin = () => {
  const source = require("../../../assets/options.png");
  const profile = require("../../../assets/groupImg.png");
  const addGroup = require("../../../assets/addgroup.png");
  const dp = require("../../../assets/dp.png");
  const dp2 = require("../../../assets/dp2.png");
  const navigation = useNavigation();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
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

          <Container style={PreJoinStyles.displayInfo}>
            <Image source={profile} style={PreJoinStyles.groupImage} />
            <Text style={PreJoinStyles.groupName}>Vintage Community</Text>
            <Text style={PreJoinStyles.groupInfo}>Group in vintage</Text>
            <Text style={PreJoinStyles.groupMembers}>243 Members</Text>
          </Container>

          <GapComponent height={ms(18)} />

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
                <View 
                style={PreJoinStyles.groupCont}
              
                >
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
              <Icon name={"arrow-forward-ios"} color={"#838383"} size={22} />
            </TouchableOpacity>
          </Container>

          <GapComponent height={ms(18)} />
          <Container style={PreJoinStyles.rulesCont}>
            <Text
              style={{
                color: "#D9D9D9",
                fontSize: 12,
                fontWeight: "500",
              }}
            >
              1. Do not Post links. (You will be kicked out)
            </Text>
            <Text
              style={{
                color: "#D9D9D9",
                fontSize: 12,
                fontWeight: "500",
              }}
            >
              2. Respect everyone You dont know who is behind the keyboard
            </Text>

            <GapComponent height={ms(12)} />
            <Text
              style={{
                color: "#838383",
                fontSize: 12,
                fontWeight: "300",
              }}
            >
              Created by +233 89394334
            </Text>
          </Container>
          <GapComponent height={ms(18)} />
          <Container style={PreJoinStyles.rulesCont}>
            <Text
              style={{
                color: "#838383",
                fontSize: 12,
                fontWeight: "300",
              }}
            >
              243 Members
            </Text>
            <View style={PreJoinStyles.membersCont}>
              <Image
                source={addGroup}
                style={{
                  height: 35,
                  width: 35,
                  borderRadius: 50,
                }}
              />
              <Text
                style={{
                  color: "#D9D9D9",
                  fontSize: 12,
                  fontWeight: "500",
                }}
              >
                Add Members
              </Text>
            </View>

            <View style={PreJoinStyles.membersCont}>
              <Image
                source={dp2}
                style={{
                  height: 35,
                  width: 35,
                  borderRadius: 50,
                }}
              />
              <Text
                style={{
                  color: "#D9D9D9",
                  fontSize: 12,
                  fontWeight: "500",
                }}
              >
                ~ Chidex
              </Text>
            </View>

            <View style={PreJoinStyles.membersCont}>
              <Image
                source={dp}
                style={{
                  height: 35,
                  width: 35,
                  borderRadius: 50,
                }}
              />
              <Text
                style={{
                  color: "#D9D9D9",
                  fontSize: 12,
                  fontWeight: "500",
                }}
              >
                Zee_manup
              </Text>
            </View>
            <Text
              style={{
                color: "#CF833F",
                marginTop: 12,
                marginHorizontal: 8,
              }}
            >
              View all (241 more)
            </Text>
          </Container>

          <Container></Container>
          <View
            style={{
              position: "absolute",
              bottom: 0,
              height: 39,
              backgroundColor: "#000",
              flexDirection: "row",
              alignItems: "center",
              width: "100%",
              marginLeft: 22,
            }}
          >
            <Icon
              style={{ alignItems: "center" }}
              name={"exit-to-app"}
              color={"#E32D2D"}
              size={22}
            />

            <Text
              style={{
                // textAlign: "center",
                justifyContent: "center",

                marginTop: "auto",
                marginBottom: "auto",
                fontSize: 10,
                color: "#D1D1D1",
                fontWeight: 600,
              }}
            >
              Exit Group
            </Text>
          </View>
        </Canvas>
      </ScrollView>
    </SafeAreaView>
  );
};

export default PreJoin;
