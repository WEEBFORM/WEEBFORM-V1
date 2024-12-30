import { StyleSheet, Platform } from "react-native";
import { ms } from "react-native-size-matters";

const CommunityStyles = StyleSheet.create({
  addTimelineBtn: {
    backgroundColor: "#CF833F",
    bottom: ms(16),
    width: ms(60),
    height: ms(60),
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.09,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 2,
      },
    }),
  },

  addTimelineContainer: {
    alignSelf: "flex-end",
    position: "absolute",
    bottom: ms(16),
  },
  nameInput: {
    height: 61,
    width: "100%",
    borderWidth: 1,
    fontSize: 10,
    borderColor: "#3B3B3B",
    borderRadius: 10,
    padding: 10,
    color: "#767676",
  },
  maxText: {
    fontSize: 11,
    color:'#FFFFFF',
    fontWeight:'300',
    padding:10,

  },
  introInput: {
    height: 149,
    width: "100%",
    borderWidth: 1,
    fontSize: 10,
    borderColor: "#3B3B3B",
    borderRadius: 10,
    padding: 10,
    color: "#767676",
  },
  createBtn: {
    backgroundColor: "#CF833F",
    height: 46,
    width: '100%',
    padding: 10,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createText: {
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
    justifyContent: 'center',
    color: '#101010',

  }


});

export default CommunityStyles;
