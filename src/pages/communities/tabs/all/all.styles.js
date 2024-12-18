import {StyleSheet, Platform} from 'react-native';
import {ms} from 'react-native-size-matters';

const CommunityStyles = StyleSheet.create({
    addTimelineBtn: {
        backgroundColor: '#CF833F',
        bottom: ms(16),
        width: ms(60),
        height: ms(60),
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        ...Platform.select({
          ios: {
            shadowColor: '#000',
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
        alignSelf: 'flex-end',
        position: 'absolute',
        bottom: ms(16),
      },

})

export default CommunityStyles