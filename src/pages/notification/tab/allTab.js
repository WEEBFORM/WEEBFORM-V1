import {
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import React, { useRef } from "react";
import NotificationItem from "../../../components/notification-item";
import { notificationData } from "../../../constant/data";
import { useNavigation } from "@react-navigation/native";
import RBSheet from "react-native-raw-bottom-sheet";
import GapComponent from "../../../components/gap-component";
import { ms } from "react-native-size-matters";
import Container from "../../../components/ui/container";



const AllTab = () => {
  const optionSheetRef = useRef(null);
  const navigation = useNavigation();
  const delImg = require('../../../assets/del.png')

  const handleOptionsPress = () => {
    optionSheetRef.current?.open();
  };

  const handleImagePress = () => {
    navigation.navigate("UsersProfile");
  };
  return (
    <View>
      <FlatList
        data={notificationData}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <NotificationItem
            img={item.img}
            text={item.text}
            time={item.time}
            onImagePress={() => handleImagePress()}
            onOptionsPress={() => handleOptionsPress()}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      <RBSheet
        ref={optionSheetRef}
        height={118}
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
              height: 49,
              width: "100%",
              backgroundColor: "#3B3B3B",
              borderRadius: 12,
              padding: 12,
              // gap:20,
              justifyContent: "space-evenly",
            }}
          >
            
        
            <TouchableOpacity
            style={{
              flexDirection: "row",
              justifyContent: 'space-between'
            }}
            >
              <Text
                style={{
                  color: "#E32D2D",
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                Delete this notifications{" "}
              </Text>

              <Image 
              source={delImg}
              style={{
                alignItems: 'center',
                height: 20,
                width: 20,
              }}
              />
            </TouchableOpacity>
          </View>
        </Container>
      </RBSheet>
    </View>
  );
};

export default AllTab;

const styles = StyleSheet.create({});
