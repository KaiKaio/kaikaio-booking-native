import React, { useCallback, useEffect, useState } from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';
import {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type AnimatedNumberProps = {
  value: number;
  /** 动画时长（ms），0 表示直接跳变 */
  duration?: number;
  /** 小数位数，默认 2 */
  precision?: number;
  style?: StyleProp<TextStyle>;
};

/**
 * 数字滚动文本：value 变化时以 timing 动画平滑过渡到新值。
 * Reanimated 4 中 SharedValue.addListener 仅限 UI runtime 调用，
 * 因此用 useAnimatedReaction 监听动画值，通过 runOnJS 回写格式化文本。
 */
const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  style,
  duration = 500,
  precision = 2,
}) => {
  const animated = useSharedValue(value);
  const [display, setDisplay] = useState(() => value.toFixed(precision));

  const applyDisplay = useCallback((next: number) => {
    setDisplay(next.toFixed(precision));
  }, [precision]);

  useAnimatedReaction(
    () => animated.value,
    (next) => {
      runOnJS(applyDisplay)(next);
    },
    [applyDisplay]
  );

  useEffect(() => {
    if (duration <= 0) {
      animated.value = value;
      return;
    }
    animated.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [value, duration, animated]);

  return <Text style={style}>{display}</Text>;
};

export default AnimatedNumber;
