import React from "react";
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  Image,
  TextInput,
  Che,
  TouchableOpacity,
} from "react-native";
import Container from "../../components/ui/container";
import GapComponent from "../../components/gap-component";

const UsersProfile = () => {
  const dp = require("../../assets/pic1.png");
  const calender = require("../../assets/calender.png");
  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <Image
          source={require("../../assets/boss.png")}
          style={styles.coverphoto}
        />
      </View>
      <View style={styles.pfpCon}>
        <Image source={require("../../assets/pic1.png")} style={styles.pfp} />
        <Text style={{ ...styles.text, fontWeight: 800, fontSize: 24 }}>
          BossLady
        </Text>
        <Text style={{ ...styles.text, fontWeight: 400, fontSize: 20 }}>
          @boss_lady
        </Text>
      </View>
      <View style={styles.bottom}>
        <View style={styles.bio}>
          <Text style={{ ...styles.text, fontWeight: 800, fontSize: 18 }}>
            Anime freek
          </Text>
        </View>
        <View style={styles.stats}>
          <View style={styles.eachStats}>
            <Text style={{ ...styles.text, fontWeight: 800, fontSize: 18 }}>
              5.7K
            </Text>
            <Text style={{ ...styles.text, fontWeight: 500, fontSize: 14 }}>
              Following
            </Text>
          </View>
          <View style={styles.eachStats}>
            <Text style={{ ...styles.text, fontWeight: 800, fontSize: 18 }}>
              240
            </Text>
            <Text style={{ ...styles.text, fontWeight: 500, fontSize: 14 }}>
              Followers
            </Text>
          </View>
          <View style={styles.eachStats}>
            <Text style={{ ...styles.text, fontWeight: 800, fontSize: 18 }}>
              7K
            </Text>
            <Text style={{ ...styles.text, fontWeight: 500, fontSize: 14 }}>
              Posts
            </Text>
          </View>
          <View style={styles.eachStats}>
            <Text style={{ ...styles.text, fontWeight: 800, fontSize: 18 }}>
              567
            </Text>
            <Text style={{ ...styles.text, fontWeight: 500, fontSize: 14 }}>
              Comments
            </Text>
          </View>
        </View>
        <Container>
          <Text
            style={{
              color: "#A4A4A4",
              fontSize: 20,
              fontWeight: "800",
            }}
          >
            About
          </Text>

          <View
            style={{
              flexDirection: "row",
              gap: 4,
              alignItems: "center",
              marginTop: 12,
            }}
          >
            <Image
              source={calender}
              style={{
                height: 25,
                width: 25,
              }}
            />
            <Text
              style={{
                color: "#A4A4A4",
                fontSize: 18,
                fontWeight: "600",
              }}
            >
              Joined May 14, 2025
            </Text>
          </View>

          <GapComponent height={40} />
          <TouchableOpacity
            style={{
              backgroundColor: "#CF833F",
              width: "90%",
              height: 63,
              borderRadius: 35,
              padding: 10,
              alignItems: "center",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            <Text
              style={{
                textAlign: "center",
                marginTop: "auto",
                marginBottom: "auto",
                fontSize: 16,
                fontWeight: "600",
              }}
            >
              Follow
            </Text>
          </TouchableOpacity>
        </Container>
      </View>
      <Text>Profile</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "black",
    flex: 1,
  },
  top: {
    height: "25%",
  },
  coverphoto: {
    width: "100%",
    height: "100%",
  },
  pfpCon: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    marginTop: "-34%",
    marginBottom: "7%",
  },
  pfp: {
    borderWidth: 5,
    borderColor: "black",
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  text: {
    color: "#A4A4A4",
    // fontSize: 24
  },
  bottom: {
    flexDirection: "column",
    gap: 15,
  },
  bio: {
    backgroundColor: "#101010",
    padding: 30,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
  },
  stats: {
    flexDirection: "row",
    padding: 20,
    backgroundColor: "#101010",
    borderRadius: 20,
  },
  eachStats: {
    width: "25%",
    alignItems: "center",
    borderRightWidth: 2,
    borderColor: "2C2B2B",
  },
});

export default UsersProfile;
