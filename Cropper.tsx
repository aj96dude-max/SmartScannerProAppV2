import React, { useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, useAnimatedProps, runOnJS } from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Svg, { Polygon } from 'react-native-svg';

const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);

interface Point {
  x: number;
  y: number;
}

interface CropperProps {
  imageWidth: number;
  imageHeight: number;
  initialEdges: { tl: Point; tr: Point; br: Point; bl: Point };
  onCornersUpdate: (corners: { tl: Point; tr: Point; br: Point; bl: Point }) => void;
}

const Knob = ({ x, y, onUpdate }: { x: Animated.SharedValue<number>, y: Animated.SharedValue<number>, onUpdate: () => void }) => {
  const pan = Gesture.Pan()
    .onChange((event) => {
      x.value += event.changeX;
      y.value += event.changeY;
    })
    .onEnd(() => {
      runOnJS(onUpdate)();
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value - 15 }, { translateY: y.value - 15 }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.knob, animatedStyle]} />
    </GestureDetector>
  );
};

export const Cropper: React.FC<CropperProps> = ({ imageWidth, imageHeight, initialEdges, onCornersUpdate }) => {
  const [layout, setLayout] = useState({ width: 0, height: 0, x: 0, y: 0, scale: 0 });

  const tlX = useSharedValue(0);
  const tlY = useSharedValue(0);
  const trX = useSharedValue(0);
  const trY = useSharedValue(0);
  const brX = useSharedValue(0);
  const brY = useSharedValue(0);
  const blX = useSharedValue(0);
  const blY = useSharedValue(0);

  // Wait for layout to compute scale
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const scale = Math.min(width / imageWidth, height / imageHeight);
    const renderedW = imageWidth * scale;
    const renderedH = imageHeight * scale;
    const x = (width - renderedW) / 2;
    const y = (height - renderedH) / 2;
    setLayout({ width: renderedW, height: renderedH, x, y, scale });

    // Initialize knob positions based on the image scale
    if (tlX.value === 0 && tlY.value === 0 && scale > 0) {
      tlX.value = x + initialEdges.tl.x * scale;
      tlY.value = y + initialEdges.tl.y * scale;
      trX.value = x + initialEdges.tr.x * scale;
      trY.value = y + initialEdges.tr.y * scale;
      brX.value = x + initialEdges.br.x * scale;
      brY.value = y + initialEdges.br.y * scale;
      blX.value = x + initialEdges.bl.x * scale;
      blY.value = y + initialEdges.bl.y * scale;
      // We don't trigger update here because they are initial values
    }
  };

  const triggerUpdate = () => {
    if (layout.scale === 0) {return;}
    const invScale = 1 / layout.scale;
    onCornersUpdate({
      tl: { x: (tlX.value - layout.x) * invScale, y: (tlY.value - layout.y) * invScale },
      tr: { x: (trX.value - layout.x) * invScale, y: (trY.value - layout.y) * invScale },
      br: { x: (brX.value - layout.x) * invScale, y: (brY.value - layout.y) * invScale },
      bl: { x: (blX.value - layout.x) * invScale, y: (blY.value - layout.y) * invScale },
    });
  };

  const animatedProps = useAnimatedProps(() => {
    return {
      points: `${tlX.value},${tlY.value} ${trX.value},${trY.value} ${brX.value},${brY.value} ${blX.value},${blY.value}`,
    };
  });

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="box-none">
      {layout.scale > 0 && (
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <AnimatedPolygon
            animatedProps={animatedProps}
            fill="rgba(0, 255, 0, 0.2)"
            stroke="#00FF00"
            strokeWidth="2"
          />
        </Svg>
      )}
      {layout.scale > 0 && (
        <>
          <Knob x={tlX} y={tlY} onUpdate={triggerUpdate} />
          <Knob x={trX} y={trY} onUpdate={triggerUpdate} />
          <Knob x={brX} y={brY} onUpdate={triggerUpdate} />
          <Knob x={blX} y={blY} onUpdate={triggerUpdate} />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  knob: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,255,0,0.5)',
    borderWidth: 2,
    borderColor: '#FFF',
  },
});
