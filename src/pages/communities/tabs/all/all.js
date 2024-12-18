import { View, Text, FlatList, TouchableOpacity } from "react-native";
import React from "react";
import GapComponent from "../../../../components/gap-component";
import { ms } from "react-native-size-matters";
import CommunityList from "../../../../components/community-list";
import { communityData } from "../../../../constant/data";
import Container from "../../../../components/ui/container";
import CommunityStyles from "./all.styles";
import  Icon  from "react-native-vector-icons/Feather";

const AllTab = () => {
  return (
    <View>
      <Container style={{ marginTop: 27 }}>
        <FlatList
          data={communityData}
          numColumns={1}
          snapToAlignment="start"
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <GapComponent height={ms(8)} />}
          renderItem={({ item }) => (
            <CommunityList
              name={item.name}
              categories={item.categories}
              img={item.img}
              time={item.time}
              members={item.img}
            />
          )}
        />
      </Container>

      <Container style={CommunityStyles.addTimelineContainer}>
        <TouchableOpacity
          style={CommunityStyles.addTimelineBtn}
          // onPress={goToAddTimeline}
        >
          <Icon name="plus" size={24} color={'#fff'} />
        </TouchableOpacity>
      </Container>
    </View>
  );
};

export default AllTab;
