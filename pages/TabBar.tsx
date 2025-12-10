import React, { useEffect, useRef } from 'react';
import { CommonActions } from '@react-navigation/native';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import IconFont from '@/components/IconFont';

interface TabConfig {
  label: string;
  icon: string;
}

const TAB_CONFIG: Record<string, TabConfig> = {
  List: { label: '账单', icon: 'wj-zd' },
  Statistics: { label: '统计', icon: 'tongji' },
  Account: { label: '我的', icon: 'wode' },
};

// Subcomponent for individual tab items to handle animation
const TabItem = ({
  isFocused,
  options,
  onPress,
  onLongPress,
  config,
  activeColor,
  inactiveColor,
}: {
  route: any;
  isFocused: boolean;
  options: any;
  onPress: () => void;
  onLongPress: () => void;
  config: TabConfig;
  activeColor: string;
  inactiveColor: string;
}) => {
  // Initialize scale based on focus state
  const scaleAnim = useRef(new Animated.Value(isFocused ? 1.1 : 1)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: isFocused ? 1.1 : 1,
      useNativeDriver: true,
      friction: 8,
      tension: 40,
    }).start();
  }, [isFocused, scaleAnim]);

  const color = isFocused ? activeColor : inactiveColor;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={options.tabBarAccessibilityLabel}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tabItem}
      activeOpacity={0.8}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <IconFont
          style={styles.tabIcon}
          name={config.icon}
          size={30}
          color={color}
        />
      </Animated.View>
      <Text style={[styles.tabLabel, { color }]}>
        {config.label}
      </Text>
    </TouchableOpacity>
  );
};

const TabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  const insets = useSafeAreaInsets();
  const activeColor = '#0090FF';
  const inactiveColor = '#000';

  return (
    <View style={[styles.safeArea, { paddingBottom: insets.bottom }]}>
      <View style={styles.tabBar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const config = TAB_CONFIG[route.name];
          
          // 如果没有配置（比如未知的路由），则跳过
          if (!config) return null;

          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              // The `merge: true` option makes sure that the params inside the tab screen are preserved
              navigation.dispatch(CommonActions.navigate({ name: route.name, merge: true }));
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <TabItem
              key={route.key}
              route={route}
              isFocused={isFocused}
              options={options}
              onPress={onPress}
              onLongPress={onLongPress}
              config={config}
              activeColor={activeColor}
              inactiveColor={inactiveColor}
            />
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  tabBar: { 
    flexDirection: 'row', 
    height: 70, 
    backgroundColor: '#fff', 
    alignItems: 'center', 
    justifyContent: 'space-around' 
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabIcon: { fontSize: 22 },
  tabLabel: { fontSize: 12, marginTop: 2 },
});

export default TabBar;
