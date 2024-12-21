import React from 'react';
import {View} from 'react-native';



const GapComponent = (props) => {
  const {width, height, flex, style} = props;
  return <View style={[{height, width, flex}, style]} />;
};

export default GapComponent;
