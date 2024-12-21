import { View, Text, Image, TouchableOpacity } from "react-native";
import React from "react";
import Container from "../ui/container";
import CommunityListStyles from "./communityList.styles";

const CommunityList = ({ name, categories, members, img, time }) => {
  const memberIcon = require("../../assets/members.png");
  return (
    <TouchableOpacity style={CommunityListStyles.container}>
      <View style={CommunityListStyles.infoCont}>
        <Image style={CommunityListStyles.groupImg} source={img} />
        <View style={CommunityListStyles.nameCont}>
          <View style={CommunityListStyles.nammeb}>
            <Text style={CommunityListStyles.name}>{name}</Text>
            <View style={CommunityListStyles.memberCont}>
              <Image
                style={CommunityListStyles.memberIcon}
                source={memberIcon}
              />

              <Text style={CommunityListStyles.memberText}>65444</Text>
            </View>
          </View>
          <Text style={CommunityListStyles.description}>{categories}</Text>
        </View>
      </View>
      <View style={CommunityListStyles.timeCont}>
        <Text style={CommunityListStyles.time}>{time}</Text>
      </View>
    </TouchableOpacity>
  );
};

export default CommunityList;
