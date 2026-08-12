import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatisticsData } from '../types/bill';
import { RootStackParamList } from '../types/navigation';
import CategoryIcon from './CategoryIcon';
import { useCategory } from '../context/CategoryContext';
import { theme } from '../theme';

type CompositionNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Main'>;

interface CompositionProps {
  data: StatisticsData[];
}



// 旋转动画时长
const ROTATION_DURATION = 450;

const Composition: React.FC<CompositionProps> = ({ data }) => {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { getCategoryItem } = useCategory();
  const navigation = useNavigation<CompositionNavigationProp>();

  // 1 for expense, 2 for income
  const targetType = type === 'expense' ? '1' : '2';

  const filteredData = useMemo(
    () => data.filter(item => String(item.pay_type) === targetType),
    [data, targetType],
  );

  // Calculate total for the current list to show percentage relative to this list
  const totalAmount = filteredData.reduce((sum, item) => sum + Number(item.number), 0);

  // Sort by amount descending
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => Number(b.number) - Number(a.number));
  }, [filteredData]);

  // 饼图数据
  const pieData = useMemo(() => {
    return sortedData.slice(0, 10).map((item) => {
      const color = getCategoryItem(item.type_id)?.background_color || '#C5C5C5';
      return {
        value: Number(item.number),
        color,
        text: `${((Number(item.number) / totalAmount) * 100).toFixed(1)}%`,
      }
    });
  }, [sortedData, totalAmount, getCategoryItem]);

  // 旋转动画相关状态
  // rotationAnim: 甜甜圈整体旋转角度（deg）；cumulativeRotation: 累计角度，保证连续切换沿最短路径旋转
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const cumulativeRotation = useRef(0);
  const pendingIndex = useRef(0);
  // 顶部指示文案与中心标签的过渡动画（淡入淡出 / 位移 / 缩放）
  const indicatorOpacity = useRef(new Animated.Value(1)).current;
  const indicatorTranslateY = useRef(new Animated.Value(0)).current;
  const centerOpacity = useRef(new Animated.Value(1)).current;
  const centerScale = useRef(new Animated.Value(1)).current;

  // 计算目标旋转角度（deg），使指定索引的扇形中点位于顶部中心
  // gifted-charts 默认从顶部 (12点钟方向) 开始顺时针绘制，负角度即逆时针旋转
  const computeTargetAngle = (index: number) => {
    const totalValue = pieData.reduce((sum, item) => sum + item.value, 0);
    if (pieData.length === 0 || totalValue === 0) return 0;

    const safeIndex = ((index % pieData.length) + pieData.length) % pieData.length;

    let precedingSum = 0;
    for (let i = 0; i < safeIndex; i++) {
      precedingSum += pieData[i].value;
    }

    // 目标扇形中点相对于绘制起点的比例 (0-1)
    const ratio = (precedingSum + pieData[safeIndex].value / 2) / totalValue;

    return -360 * ratio;
  };

  // 切换收支类型 / 数据源变化时，重置选中项与旋转角度（不做动画）
  // 注意：累计角度基准必须与动画值同步重置，否则下次点击算出的旋转增量会错乱
  useEffect(() => {
    setSelectedIndex(0);
    pendingIndex.current = 0;
    rotationAnim.stopAnimation();
    const resetAngle = computeTargetAngle(0);
    cumulativeRotation.current = resetAngle;
    rotationAnim.setValue(resetAngle);
    indicatorOpacity.setValue(1);
    indicatorTranslateY.setValue(0);
    centerOpacity.setValue(1);
    centerScale.setValue(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, data]);

  // 整体旋转的插值（rotationAnim 稳定，只需创建一次）
  const rotation = useMemo(
    () => rotationAnim.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] }),
    [rotationAnim],
  );

  const renderPieChart = () => {
    return (
      <PieChart
        data={pieData}
        donut
        innerRadius={70}
        radius={90}
        innerCircleColor={theme.colors.background.paper}
        initialAngle={0}
        isAnimated={true}
        animationDuration={500}
      />
    )
  }

  // 中心标签：独立覆盖在甜甜圈上方，不随图表旋转，天然保持直立
  const renderCenterLabel = () => {
    const selectedItem = sortedData[Math.min(selectedIndex, sortedData.length - 1)];
    if (!selectedItem) return null;
    const originType = getCategoryItem(selectedItem.type_id);
    return (
      <View style={styles.centerOverlay} pointerEvents="none">
        <Animated.View
          style={[
            styles.chartCenter,
            { opacity: centerOpacity, transform: [{ scale: centerScale }] },
          ]}
        >
          <View style={[
            styles.chartCenterLabel,
            originType?.background_color && { backgroundColor: originType.background_color },
          ]}>
            <CategoryIcon icon={originType?.icon || 'question'} size={22} />
          </View>
          <Text style={styles.chartCenterValue}>{((Number(selectedItem.number) / totalAmount) * 100).toFixed(2)}%</Text>
        </Animated.View>
      </View>
    );
  };

  const goToIndex = (getNewIndex: (current: number) => number, direction: 1 | -1) => {
    const count = pieData.length;
    if (count <= 1) return;

    // 基于 pendingIndex 计算，保证快速连点时每次都能正确前进/后退一格
    const newIndex = ((getNewIndex(pendingIndex.current) % count) + count) % count;
    pendingIndex.current = newIndex;

    // 1. 甜甜圈沿最短路径平滑旋转
    const target = computeTargetAngle(newIndex);
    let delta = (((target - cumulativeRotation.current) % 360) + 360) % 360;
    if (delta > 180) delta -= 360;
    // 仅两个分类时差值恰为 180°，此时按点击方向旋转
    if (delta === 180) delta = -180 * direction;
    if (delta !== 0) {
      cumulativeRotation.current += delta;
      Animated.timing(rotationAnim, {
        toValue: cumulativeRotation.current,
        duration: ROTATION_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }

    // 2. 顶部指示文案与中心标签先淡出，切换内容后再过渡回来，避免生硬跳变
    Animated.parallel([
      Animated.timing(indicatorOpacity, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(centerOpacity, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(centerScale, { toValue: 0.75, duration: 100, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (!finished) return; // 被下一次点击打断时，交给最新的动画收尾
      setSelectedIndex(newIndex);
      indicatorTranslateY.setValue(6);
      centerScale.setValue(1.12);
      Animated.parallel([
        Animated.timing(indicatorOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(indicatorTranslateY, {
          toValue: 0,
          duration: 250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(centerOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(centerScale, {
          toValue: 1,
          friction: 6,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const handlePrev = () => {
    goToIndex((current) => current - 1, -1);
  };

  const handleNext = () => {
    goToIndex((current) => current + 1, 1);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>收支构成</Text>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, type === 'expense' && styles.activeTab]}
            onPress={() => setType('expense')}
          >
            <Text style={[styles.tabText, type === 'expense' && styles.activeTabText]}>支出</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, type === 'income' && styles.activeTab]}
            onPress={() => setType('income')}
          >
            <Text style={[styles.tabText, type === 'income' && styles.activeTabText]}>收入</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 甜甜圈图 */}
      {sortedData.length > 0 && (
        <View style={styles.chartWrapper}>
          <TouchableOpacity style={styles.arrowButton} onPress={handlePrev}>
            <MaterialIcons name="arrow-back-ios" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
          
          <View style={styles.chartArea}>
            {/* 指示线 */}
            <Animated.View
              style={[
                styles.indicatorContainer,
                { opacity: indicatorOpacity, transform: [{ translateY: indicatorTranslateY }] },
              ]}
            >
               <Text style={styles.indicatorCategoryName}>
                 {sortedData[selectedIndex]?.type_name}
               </Text>
               <Text style={styles.indicatorAmount}>
                 {Number(sortedData[selectedIndex]?.number).toFixed(2)}
               </Text>
               <View style={styles.indicatorLine} />
            </Animated.View>

            <View style={styles.chartContainer}>
              {/* 饼图整体随选中项平滑旋转 */}
              <Animated.View style={{ transform: [{ rotate: rotation }] }}>
                {renderPieChart()}
              </Animated.View>
              {/* 中心标签覆盖层：不参与旋转，带淡入淡出 + 缩放过渡 */}
              {renderCenterLabel()}
            </View>
          </View>

          <TouchableOpacity style={styles.arrowButton} onPress={handleNext}>
            <MaterialIcons name="arrow-forward-ios" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.list}>
        {sortedData.map((item) => {
          const amount = Number(item.number);
          const percentage = totalAmount > 0 ? (amount / totalAmount * 100) : 0;
          const curCategoryItem = getCategoryItem(item.type_id);

          const maxItemAmount = sortedData?.[0]?.number || 0;
          // 以最大金额为基准，计算当前项的相对宽度，最小宽度为5%，最大宽度为100%

          // Bar width calculation
          const barWidth = maxItemAmount > 0 ? Math.max(5, (amount / maxItemAmount) * 100) : 5; // 最小宽度为5%
          const itemColor = curCategoryItem?.background_color || '#C5C5C5';

          const handleCategoryPress = () => {
            navigation.navigate('CategoryDetails', {
              type_id: item.type_id,
              type_name: item.type_name,
              pay_type: targetType as '1' | '2',
            });
          };

          return (
            <TouchableOpacity 
              key={`${item.pay_type}-${item.type_id}`} 
              style={styles.item}
              onPress={handleCategoryPress}
            >
              <View style={[styles.iconWrapper, curCategoryItem?.background_color && { backgroundColor: curCategoryItem.background_color }]}>
                 <CategoryIcon icon={curCategoryItem?.icon || 'question'} size={22} />
              </View>

              <View style={styles.info}>
                <Text style={styles.categoryName}>{item.type_name}</Text>
                <Text style={styles.amountText}>{amount.toFixed(2)}</Text>
                <View style={[styles.bar, { width: `${Number(barWidth.toFixed(2))}%`, backgroundColor: itemColor }]} />
              </View>

              <Text style={styles.percentageText}>{percentage.toFixed(2)}%</Text>
            </TouchableOpacity>
          );
        })}

        {sortedData.length === 0 && (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>暂无数据</Text>
            </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
    backgroundColor: theme.colors.background.paper,
    borderRadius: theme.spacing.radius.md,
    padding: theme.spacing.lg,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.size.lg,
    fontWeight: theme.typography.weight.bold,
    color: theme.colors.text.primary,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background.default,
    borderRadius: theme.spacing.radius.md,
    padding: 2,
  },
  tab: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: 4,
  },
  activeTab: {
    backgroundColor: theme.colors.background.paper,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  tabText: {
    fontSize: theme.typography.size.sm,
    color: theme.colors.text.secondary,
  },
  activeTabText: {
    color: theme.colors.primary,
    fontWeight: theme.typography.weight.medium,
  },
  chartWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.sm,
    height: 250,
  },
  arrowButton: {
    padding: theme.spacing.sm,
  },
  chartArea: {
    alignItems: 'center',
    position: 'relative',
    flex: 1,
  },
  indicatorContainer: {
    alignItems: 'center',
    marginBottom: -10,
    zIndex: 1,
  },
  indicatorCategoryName: {
    fontSize: theme.typography.size.sm,
    color: theme.colors.text.secondary,
  },
  indicatorAmount: {
    fontSize: theme.typography.size.md,
    color: theme.colors.text.primary,
    fontWeight: theme.typography.weight.medium,
  },
  indicatorLine: {
    width: 2,
    height: 15,
    backgroundColor: '#C5C5C5',
    marginTop: 2,
    marginBottom: 0,
  },
  chartContainer: {
    alignItems: 'center',
  },
  centerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartCenterLabel: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.background.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartCenterValue: {
    fontSize: theme.typography.size.lg,
    fontWeight: theme.typography.weight.bold,
    color: theme.colors.text.primary,
    marginTop: 4,
  },
  list: {
    gap: theme.spacing.lg,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    boxSizing: 'border-box',
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.background.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  info: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: theme.spacing.xs,
    flex: 1,
    marginRight: theme.spacing.md,
  },
  categoryName: {
    width: 60,
    fontSize: theme.typography.size.md,
    fontWeight: theme.typography.weight.bold,
  },
  amountText: {
    marginTop: theme.spacing.xs,
    width: 80,
    fontSize: theme.typography.size.md,
    color: theme.colors.text.primary,
  },
  bar: {
    height: 6,
    borderRadius: 3,
    marginRight: theme.spacing.md,
  },
  percentageText: {
    fontSize: theme.typography.size.md,
    color: theme.colors.text.primary,
    fontWeight: theme.typography.weight.medium,
  },
  emptyContainer: {
    paddingVertical: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.text.placeholder,
    fontSize: theme.typography.size.md,
  }
});

export default Composition;
