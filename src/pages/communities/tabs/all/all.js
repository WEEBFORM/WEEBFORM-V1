import { View, Text, FlatList } from "react-native";
import React from "react";
import GapComponent from "../../../../components/gap-component";
import { ms } from "react-native-size-matters";
import CommunityList from "../../../../components/community-list";
import { communityData } from "../../../../constant/data";
import Container from "../../../../components/ui/container";

const AllTab = () => {
  return (
    <Container style={{marginTop: 27}}>
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
  );
};

export default AllTab;
