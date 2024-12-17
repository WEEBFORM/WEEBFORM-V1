import React from 'react';
import {View} from 'react-native';
import CanvasStyle from './canvas.styles';
import {ms} from 'react-native-size-matters';

const Canvas = (props) => {
  const {children, style} = props;

  return (
    <View style={[CanvasStyle.canvas, style]}>
      {children}
    </View>
  );
};

export default Canvas;
