import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
} from "react-native";
import React, { useRef } from "react";
import GapComponent from "../../../../components/gap-component";
import { ms } from "react-native-size-matters";
import CommunityList from "../../../../components/community-list";
import { communityData } from "../../../../constant/data";
import Container from "../../../../components/ui/container";
import CommunityStyles from "./all.styles";
import Icon from "react-native-vector-icons/Feather";
import RBSheet from "react-native-raw-bottom-sheet";

const AllTab = () => {
  const bottomSheetRef = useRef(null);

  const addCommunity = () => {
    bottomSheetRef.current?.open();
  };
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
          onPress={addCommunity}
        >
          <Icon name="plus" size={24} color={"#fff"} />
        </TouchableOpacity>
      </Container>

      <RBSheet
        ref={bottomSheetRef}
        height={432}
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
          <TextInput
            placeholder="Community name"
            placeholderTextColor={"#767676"}
            style={CommunityStyles.nameInput}
          />
          <Text style={CommunityStyles.maxText}>Max length is 50</Text>

          <GapComponent height={ms(10)} />
          <TextInput
            placeholder="Short intro (Optional)"
            placeholderTextColor={"#767676"}
            multiline={true} 
            textAlignVertical="top"
            style={CommunityStyles.introInput}
          />
          <Text style={CommunityStyles.maxText}>Max length is 150</Text>

          <TouchableOpacity style={CommunityStyles.createBtn}>
            <Text style={CommunityStyles.createText}>Create Community</Text>
          </TouchableOpacity>
        </Container>
      </RBSheet>
    </View>
  );
};

export default AllTab;
