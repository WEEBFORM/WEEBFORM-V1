import React from 'react';
import {View} from 'react-native';
import ContainerStyles from './container.styles';

const Container = (props) => {
  const {children, style} = props;

  return <View style={[ContainerStyles.canvas, style]}>{children}</View>;
};

export default Container;
