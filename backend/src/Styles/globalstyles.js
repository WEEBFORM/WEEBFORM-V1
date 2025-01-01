import { Button, StyleSheet } from "react-native";

export const Globalstyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  welcomeCon: {
    flex: 1,
    backgroundImage:
      "linear-gradient(180deg, #CF833F 0%, #A54A15 47.5%, #6C2A04 100%);",
    alignItems: "center",
    backgroundColor: "#CF833F",
    justifyContent: "center",
  },
  linearGradient: {
    flex: 1,
  },
  welcomeOneCon: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    paddingBottom: 150,
    paddingHorizontal: 12,
  },
  welcomeText: {
    textAlign: "center",
    fontSize: 16,
    color:'white'
  },
  welcomeTextHeader: {
    textAlign: "center",
    fontSize: 30,
    color:'white'
  },
  buttonCon: {
    backgroundColor: "#CF833F",
    borderRadius: 60,
    width: "85%",
    marginTop: 30,
    padding: 7,
    color: 'black'
  },
  ImageBg: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: 'black',
  },
  form:{
    flex: 1,
    backgroundColor: 'black',
    flexDirection:'column',
    justifyContent: 'center',
    padding: 25
  },
  formInput:{
    borderWidth: 1,
    padding: 20,
    borderRadius: 15,
    borderColor: '#EB9E71',
    color:'white'
  },
  formHeader:{
    fontSize: '30px',
    color:'white'
  },
  forgot:{
    flex: 1,
    flexDirection: 'column',
    justifyContent:'center',
    padding: 15,
    backgroundColor: 'black'
  },

  // Home pages 
  Home:{
    flex: 1,
    backgroundColor: '#060606',
    flexDirection:'column',
    // padding: 25,
    color: 'white',
    position: 'relative'
    // borderWidth: 1,
    // borderColor: "red"
  },
});
