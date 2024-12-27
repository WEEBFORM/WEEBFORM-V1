import { View, Text, TouchableOpacity, ImageBackground } from "react-native";
import React from "react";
import Container from "../../../components/ui/container";
import Icon from "react-native-vector-icons/MaterialIcons";
import { Image } from "react-native";
import JoinCommunityStyles from "./join-community.styles";
import Canvas from "../../../components/ui/canvas";
import { SafeAreaView } from "react-native-safe-area-context";
import GapComponent from "../../../components/gap-component";
import { ms } from "react-native-size-matters";
import { useNavigation } from "@react-navigation/native";

const JoinCommunity = () => {
  const source = require("../../../assets/options.png");
  const bg = require("../../../assets/bg.png");
  const navigation = useNavigation();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
      <Canvas>
        <Container style={JoinCommunityStyles.navContainer}>
          <View style={JoinCommunityStyles.header}>
            <TouchableOpacity
              // onPress={onBackPressAction}
              style={JoinCommunityStyles.navIconContainer}
            >
              <Icon name={"arrow-back-ios"} color={"#FFFFFF"} size={22} />
            </TouchableOpacity>
            <View>
              <Text style={JoinCommunityStyles.title}>title</Text>
            </View>
            <TouchableOpacity>
              <Image style={JoinCommunityStyles.image} source={source} />
            </TouchableOpacity>
          </View>
        </Container>
        <View style={{ height: "100%", width: "100%" }}>
          <ImageBackground
            style={[{ width: "100%", height: "100%" }]}
            source={bg}
          >
            <GapComponent height={"50%"} />
            <Container>
              <View style={JoinCommunityStyles.created}>
                <Text style={JoinCommunityStyles.createdText1}>
                  Community created by
                </Text>
                <Text style={JoinCommunityStyles.createdText2}>Geramine</Text>
                <GapComponent height={ms(22)} />
                <Text style={JoinCommunityStyles.createdText1}>
                  Creation Date
                </Text>
                <Text style={JoinCommunityStyles.createdText2}>
                  April 3, 2024
                </Text>
                <GapComponent height={ms(22)} />
                <TouchableOpacity
                  onPress={() => navigation.navigate("PreJoin")}
                  style={JoinCommunityStyles.joinBtn}
                >
                  <Text style={JoinCommunityStyles.joinText}>Join</Text>
                </TouchableOpacity>
              </View>
            </Container>
            <View
              style={{
                position: "absolute",
                bottom: 0,
                height: 88,
                backgroundColor: "#000",
                alignItems: "center",
                width: "100%",
              }}
            >
              <Text
                style={{
                  textAlign: "center",
                  justifyContent: "center",
                  marginTop: 4,
                  fontSize: 10,
                  color: "#D1D1D1",
                  fontWeight: 600,
                }}
              >
                You cant send messages in the community at this time
              </Text>
            </View>
          </ImageBackground>
        </View>
      </Canvas>
    </SafeAreaView>
  );
};

export default JoinCommunity;
