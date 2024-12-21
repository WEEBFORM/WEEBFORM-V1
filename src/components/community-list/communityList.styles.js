import { StyleSheet } from "react-native";
import { ms } from "react-native-size-matters";

const CommunityListStyles = StyleSheet.create({
  container: {
    height: 60,
    width: "100%",
    // backgroundColor: "red",
    padding: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  infoCont: {
    flexDirection: "row",
    // alignItems: 'center',
    gap: 7,
  },
  groupImg: {
    width: 53,
    height: 53,
    borderRadius: 50,
  },
  timeCont: {
    alignItems: "center",
  },
  nameCont: {
    gap: 6,
    marginBottom: 8,
    justifyContent: "center",
    // alignItems: 'center',
  },
  memberIcon: {
    height: ms(13),
    width: ms(13),  
    alignItems:'center',  
  },
  memberCont: {
    flexDirection: 'row',
    gap: 4,
    alignItems:'center',
    padding: 8,
    marginTop: 5,
    // justifyContent: 'center',
    height: 14,
    borderRadius: 2,
    // width: 80,
    backgroundColor: '#101010',


  },
  memberText: {
    fontSize: 9,
    textAlign: 'center',
    color: '#7E7C7C',
    height: 14,
    marginTop: 3,


  },
  nammeb: {
    alignItems: 'center',
    flexDirection: 'row',
    gap:4,

  },
  name: {
    fontSize: 13,
    color: '#D9D9D9',
    fontWeight: "800",

  },
  description: {
    fontSize: 10,
    fontWeight: '400',
    color: '#999898',
// textAlign:  'center',
  },
  time: {
    fontSize: 10,
    fontWeight: '400',
    color: '#999898',
  }


});

export default CommunityListStyles;
