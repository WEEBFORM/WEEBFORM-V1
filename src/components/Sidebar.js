import React from "react";
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  Image,
  TextInput,
  Che,
  ScrollView,
  Platform,
} from "react-native";

const Sidebar = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View>
          <View style={styles.sec1}>
            <View>
              <Image
                source={require("./../assets/coverphoto.png")}
                style={styles.pfp}
              />
            </View>
            <View style={styles.sec1W}>
              <Text style={styles.text}>Shedrach</Text>
              <Text style={{ ...styles.text, color: "#D2D2D2", fontSize: 12 }}>
                (@ShedrachJitsu)
              </Text>
              <View style={styles.follw}>
                <Text style={styles.text}>2 Following</Text>
                <Text style={styles.text}>2 Followers</Text>
              </View>
            </View>
          </View>
          <View style={styles.sec2}>
            <View style={styles.sec2C}>
              <Image source={require("./../assets/homeL.png")} />
              <Text
                style={{
                  ...styles.text,
                  color: "white",
                  fontSize: 18,
                  fontWeight: 900,
                }}
              >
                Home
              </Text>
            </View>
            <View style={styles.sec2C}>
              <Image source={require("./../assets/genre.png")} />
              <Text
                style={{
                  ...styles.text,
                  color: "white",
                  fontSize: 18,
                  fontWeight: 900,
                }}
              >
                All Genres
              </Text>
            </View>
            <View style={styles.sec2C}>
              <Image source={require("./../assets/newss.png")} />
              <Text
                style={{
                  ...styles.text,
                  color: "white",
                  fontSize: 18,
                  fontWeight: 900,
                }}
              >
                News
              </Text>
            </View>
          </View>
          <View style={styles.sec3}>
            <View style={styles.sec3T}>
              <Image
                source={require("../assets/postInd.png")}
                style={styles.ind}
              />
              <Text
                style={{
                  ...styles.text,
                  color: "white",
                  fontSize: 16,
                  fontWeight: 500,
                }}
              >
                My Library
              </Text>
            </View>
            <View style={styles.sec3O}>
              <View style={styles.sec2C}>
                <Image source={require("./../assets/newss.png")} />
                <Text
                  style={{
                    ...styles.text,
                    color: "white",
                    fontSize: 18,
                    fontWeight: 400,
                  }}
                >
                  Anime & Manga list
                </Text>
              </View>
              <View style={styles.sec2C}>
                <Image source={require("./../assets/newss.png")} />
                <Text
                  style={{
                    ...styles.text,
                    color: "white",
                    fontSize: 18,
                    fontWeight: 400,
                  }}
                >
                  Favourites
                </Text>
              </View>
              <View style={styles.sec2C}>
                <Image source={require("./../assets/reccomm.png")} />
                <Text
                  style={{
                    ...styles.text,
                    color: "white",
                    fontSize: 18,
                    fontWeight: 400,
                  }}
                >
                  Reccommendations
                </Text>
              </View>
              <View style={styles.sec2C}>
                <Image source={require("./../assets/newss.png")} />
                <Text
                  style={{
                    ...styles.text,
                    color: "white",
                    fontSize: 18,
                    fontWeight: 400,
                  }}
                >
                  Create Marketplace
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.sec4}>
            <View style={styles.sec3T}>
              <Image
                source={require("../assets/postInd.png")}
                style={styles.ind}
              />
              <Text
                style={{
                  ...styles.text,
                  color: "white",
                  fontSize: 16,
                  fontWeight: 500,
                }}
              >
                My Library
              </Text>
            </View>
            <View style={styles.sec3O}>
              <View style={styles.sec2C}>
                <Image source={require("./../assets/newss.png")} />
                <Text
                  style={{
                    ...styles.text,
                    color: "white",
                    fontSize: 18,
                    fontWeight: 400,
                  }}
                >
                  Saved Posts
                </Text>
              </View>
              <View style={styles.sec2C}>
                <Image source={require("./../assets/newss.png")} />
                <Text
                  style={{
                    ...styles.text,
                    color: "white",
                    fontSize: 18,
                    fontWeight: 400,
                  }}
                >
                  Hidden Posts
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: "3%",
    left: "0%",

    // borderColor: 'white',
    width: "75%",
    height: "105%",
    backgroundColor: '#101010',
    // backgroundColor: "red",
    zIndex: 2,
    paddingTop: 10,
  },
  text: {
    color: "white",
  },
  sec1: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    padding: 10,
    marginTop: Platform.select({
      android: 40,
      ios: 90,
    }),
    borderBottomWidth: 1,
    borderColor: "#2D2A2A",
  },
  pfp: {
    borderWidth: 5,
    borderColor: "black",
    width: 80,
    height: 80,
    borderRadius: 100,
  },
  sec1W: {
    flexDirection: "column",
    gap: 1,
  },
  follw: {
    flexDirection: "row",
    gap: 15,
    marginTop: 10,
  },
  sec2: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 15,
    padding: 10,
    paddingVertical: 30,
    borderBottomWidth: 1,
    borderColor: "#2D2A2A",
  },
  sec2C: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sec3: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 15,
    padding: 10,
    paddingVertical: 30,
    borderBottomWidth: 1,
  },
  sec3T: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: -10,
  },
  sec3O: {
    gap: 15,
    marginLeft: 10,
  },
  sec4: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 15,
    padding: 10,
    marginBottom: Platform.select({
      android: 90,
      ios: 40,
    }),
  },
});

export default Sidebar;
