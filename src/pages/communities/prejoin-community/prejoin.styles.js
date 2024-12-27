import {StyleSheet} from 'react-native';
import {ms} from 'react-native-size-matters';

const PreJoinStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: ms(64),


  },
  navContainer:{
    backgroundColor: '#070707'
  },
  navIconContainer: {
    paddingVertical: 12,
    paddingRight: 12,
  },
  displayInfo: {
    height:250,
    backgroundColor: '#000',
    alignItems:'center',
    justifyContent:'center',

  },
  displayInfoo: {
    height:'auto',
    // backgroundColor: '#000',
    alignItems:'center',
    justifyContent:'center',

  },
  groupImage: {
    height: 135,
    width:135,
    borderRadius: 50,
  },
  groupName: {
    fontStyle: "italic",
    fontWeight: "300",
    fontSize:28,
    color: '#D9D9D9',


  },
  groupInfo: {
    fontSize:16,
    color:'#838383',
    fontWeight: "300",


  },
  groupMembers: {
    fontSize: 15,
    fontWeight:"300",
    marginTop:6,
    color: '#838383',

  },
  groupsCont: {
    flexDirection: 'row',
    justifyContent: "space-between",
    // backgroundColor: '#000',
    alignItems: 'center',
    height: 80,

  },
  imgCont: {
    color: 'green',
    alignItems: 'center',
    flexDirection: 'row',
    height: '100%',
    gap: 14,

  },
  announceCont: {
    backgroundColor: '#CF833F',
    alignItems: 'center',
    borderRadius: 8,
    shadowOffset: 30,
    flexDirection: 'row',
    height: 45,
    width: 52,
    

  },

  groupCont : {
   

  },
  rulesCont : {
    backgroundColor: '#000',
    height: 'auto',
    padding: 20,


  },
  membersCont: {
    // backgroundColor: 'red',
    height: 40,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,


  },






})

export default PreJoinStyles