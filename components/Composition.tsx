import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { MaterialIcons } from '@expo/vector-icons';
import { StatisticsData } from '../types/bill';
import CategoryIcon from './CategoryIcon';
import { useCategory } from '../context/CategoryContext';
import { theme } from '../theme';

// 饼图配色方案
const CHART_COLORS = [
  '#0090FF', // primary blue
  '#5CBBF2', // secondary
  '#1BC47D', // success green
  '#FF9F43', // orange
  '#A55EEA', // purple
  '#FC5C7D', // pink
  '#45AAF2', // sky blue
  '#26DE81', // mint
  '#FD9644', // coral
  '#4ECDC4', // teal
  '#F7B731', // sunflower
  '#20BF6B', // emerald
  '#2B2B2B', // dark gray
];

interface CompositionProps {
  data: StatisticsData[];
}



const getCenterLabelComponent = (currentItem: StatisticsData & { icon: string }, totalAmount: number) => () => {
  return (
    <View style={styles.chartCenter}>
      <View style={styles.chartCenterLabel}>
        <CategoryIcon icon={currentItem.icon} size={22} />
      </View>
      <Text style={styles.chartCenterValue}>{((currentItem.number / totalAmount) * 100).toFixed(2)}%</Text>
    </View>
  )
};

const Composition: React.FC<CompositionProps> = ({ data }) => {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { getCategoryIcon } = useCategory();

  // 1 for expense, 2 for income
  const targetType = type === 'expense' ? '1' : '2';

  const filteredData = data.filter(item => String(item.pay_type) === targetType);

  // Calculate total for the current list to show percentage relative to this list
  const totalAmount = filteredData.reduce((sum, item) => sum + Number(item.number), 0);

  // Sort by amount descending
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => Number(b.number) - Number(a.number));
  }, [filteredData]);

  // Handle selected index reset when type changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [type]);

  // 饼图数据
  const pieData = useMemo(() => {
    return sortedData.slice(0, 10).map((item, index) => ({
      value: Number(item.number),
      color: CHART_COLORS[index % CHART_COLORS.length],
      text: `${((Number(item.number) / totalAmount) * 100).toFixed(1)}%`,
    }));
  }, [sortedData, totalAmount]);

  // 计算当前旋转角度，使选中的扇形位于顶部中心
  const rotationAngle = useMemo(() => {
    if (pieData.length === 0) return 0;
    
    // 计算每个扇形的角度
    const totalValue = pieData.reduce((sum, item) => sum + item.value, 0);
    
    // 如果没有数据，返回0
    if (totalValue === 0) return 0;
    
    let precedingSum = 0;
    for (let i = 0; i < selectedIndex; i++) {
      precedingSum += pieData[i].value;
    }
    
    // 当前选中扇形的一半
    const halfCurrentValue = pieData[selectedIndex].value / 2;
    
    // 目标扇形中点相对于起点的比例 (0-1)
    const ratio = (precedingSum + halfCurrentValue) / totalValue;
    
    // 转换为角度
    // gifted-charts 默认从顶部 (12点钟方向) 开始顺时针绘制
    // 我们想要将选中区域的中点对齐到顶部 (12点钟方向)
    /**
     * 注意：
     * 1. transAngle 返回 0 则无旋转
     * 2. transAngle 返回 -Math.PI / 2 则顺时针旋转 90 度
     * 3. transAngle 返回 -Math.PI 则顺时针旋转 180 度
     * 4. transAngle 返回 -Math.PI * 1.5 则顺时针旋转 270 度
     * 5. transAngle 返回 -Math.PI * 2 则顺时针旋转 360 度
     */

    const transAngle = -Math.PI * 2 * ratio;

    return transAngle;
  }, [pieData, selectedIndex]);

  const handlePrev = () => {
    setSelectedIndex((prev) => (prev - 1 + pieData.length) % pieData.length);
  };

  const handleNext = () => {
    setSelectedIndex((prev) => (prev + 1) % pieData.length);
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
            <View style={styles.indicatorContainer}>
               <Text style={styles.indicatorCategoryName}>
                 {sortedData[selectedIndex]?.type_name}
               </Text>
               <Text style={styles.indicatorAmount}>
                 {Number(sortedData[selectedIndex]?.number).toFixed(2)}
               </Text>
               <View style={styles.indicatorLine} />
            </View>

            <View style={styles.chartContainer}>
              <PieChart
                  data={pieData}
                  donut
                  innerRadius={70}
                  radius={90}
                  innerCircleColor={theme.colors.background.paper}
                  centerLabelComponent={getCenterLabelComponent({
                    ...sortedData[selectedIndex],
                    icon: getCategoryIcon(sortedData[selectedIndex].type_name)
                  }, totalAmount)}
                  initialAngle={rotationAngle}
                  isAnimated={true}
                  animationDuration={500}
                />
            </View>
          </View>

          <TouchableOpacity style={styles.arrowButton} onPress={handleNext}>
            <MaterialIcons name="arrow-forward-ios" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.list}>
        {sortedData.map((item, index) => {
          const amount = Number(item.number);
          const percentage = totalAmount > 0 ? (amount / totalAmount * 100) : 0;
          const icon = getCategoryIcon(item.type_name);

          // Bar width calculation: simple scaling
          // Scale factor 1.5 ensures 100% -> 150dp, which fits most screens
          const barWidth = Math.max(percentage * 1.5, 4);
          const itemColor = CHART_COLORS[index % CHART_COLORS.length];

          return (
            <View key={`${item.pay_type}-${item.type_id}`} style={styles.item}>
              <View style={[styles.colorDot, { backgroundColor: itemColor }]} />

              <View style={styles.iconWrapper}>
                 <CategoryIcon icon={icon} size={22} />
              </View>

              <View style={styles.info}>
                <Text style={styles.categoryName}>{item.type_name}</Text>
                <Text style={styles.amountText}>{amount.toFixed(2)}</Text>
              </View>

              <View style={[styles.bar, { width: barWidth, backgroundColor: itemColor }]} />

              <View style={styles.spacer} />

              <Text style={styles.percentageText}>{percentage.toFixed(2)}%</Text>
            </View>
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
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: theme.spacing.sm,
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
  },
  spacer: {
    flex: 1,
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
