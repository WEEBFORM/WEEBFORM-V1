import {StyleSheet} from 'react-native';
import {ms} from 'react-native-size-matters';

const JoinCommunityStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: ms(64),


  },
  navContainer:{
    backgroundColor: '#000000'
  },
  navIconContainer: {
    paddingVertical: 12,
    paddingRight: 12,
  },
  flexGrow: {
    flex: 0.2,
  },
  rightElementContainer: {
    position: 'absolute',
    right: 0,
    top: '50%',
    transform: [{translateY: -12}],
  },
  title: {
    
  },
  title2: {
    // backgroundColor: 'red',
    width: 260,
    textAlign: 'center',
  },
  image: {
    // width: ms(7),
    // height: ms(36),
  },
  created: {
    // width: 350,
    height: 192,
    borderRadius: 38,
    borderWidth: 1,
    backgroundColor: '#000000',
    borderColor: '#111111',
    padding: 20,
    

  },
  createdText1: {
    color: '#FFFFFF',
    fontWeight: '300',
    fontSize: 11,
    textAlign: 'center',
    justifyContent: 'center',

  },
  createdText2: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: 14,
    textAlign: 'center',
    justifyContent: 'center',
  },
  joinBtn: {
    backgroundColor:'#CF833F',
    width: 67,
    height:23,
    borderRadius:4,
    alignItems: 'center',
    justifyContent:'center',
    marginLeft: 'auto',
    marginRight: 'auto',

  },
  joinText: {
    color: '#fff',
    fontSize: 9,
    textAlign:'center',
    fontWeight: '400',
  }
});

export default JoinCommunityStyles;
