import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Platform, ToastAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, RouteProp } from '@react-navigation/native';
import MonthYearPicker from '../components/MonthYearPicker';
import TypePicker from '../components/TypePicker';
import BillForm, { BillData, BillFormRef } from '../components/BillForm';
import BillItem from '../components/BillItem';
import { getBillList, addBill, updateBill, loadBillMonthCache, saveBillMonthCache } from '../services/bill';
import { BillDetail, DailyBill } from '../types/bill';
import CategoryIcon from '@/components/CategoryIcon';
import { useCategory } from '../context/CategoryContext';
import { theme } from '@/theme';
import { MainTabParamList } from '../types/navigation';
import { PENDING_BILLS_STORAGE_KEY } from '@/utils/storage';

// 同步状态类型
type SyncStatus = 'syncing' | 'synced' | 'failed';

type DataState = 'online' | 'offline-cached' | 'empty' | 'error';

// 定义 SubItem 类型
type SubItem = {
  id: number;
  type: string;
  icon: string;
  remark: string;
  amount: number;
  // Extended fields for editing
  typeId: string;
  date: string;
  payType: number;
  rawAmount: number;
  // 同步状态相关
  syncStatus?: SyncStatus; // 'syncing' | 'synced' | 'failed'
  localId?: string; // 本地唯一标识,用于乐观更新时定位
  retryParams?: any; // 用于重试的参数
};

// 定义 BillItem 类型
type DailyBillGroup = {
  date: string;
  total: number;
  income: number;
  items: SubItem[];
};


const List = () => {
  const insets = useSafeAreaInsets();
  const { getCategoryIcon, categories } = useCategory();
  const route = useRoute<RouteProp<MainTabParamList, 'List'>>();
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<DailyBillGroup[]>([]);
  const [currentDate, setCurrentDate] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const loadingRef = useRef(false);
  const [summary, setSummary] = useState({ totalExpense: 0, totalIncome: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dataState, setDataState] = useState<DataState>('online');
  
  const billFormRef = useRef<BillFormRef>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // 生成唯一本地ID
  const generateLocalId = () => `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const [orderBy, setOrderBy] = useState<'ASC' | 'DESC'>('DESC');
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);

  const formatBillDate = useCallback((dateValue: string) => {
    const dateObj = /^\d+$/.test(dateValue) ? new Date(parseInt(dateValue, 10)) : new Date(dateValue);
    if (Number.isNaN(dateObj.getTime())) return '';

    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const transformDailyBills = useCallback((list: DailyBill[]): DailyBillGroup[] => {
    return list.map((daily: DailyBill) => {
      let dailyTotal = 0;
      let dailyIncome = 0;

      const items: SubItem[] = daily.bills.map((bill: BillDetail) => {
        const amount = parseFloat(bill.amount);
        const isExpense = bill.pay_type === '1';
        const displayAmount = isExpense ? -amount : amount;

        if (isExpense) {
          dailyTotal += amount;
        } else {
          dailyIncome += amount;
        }

        return {
          id: bill.id,
          type: bill.type_name,
          icon: getCategoryIcon(bill.type_name),
          remark: bill.remark,
          amount: displayAmount,
          typeId: bill.type_id,
          payType: parseInt(bill.pay_type, 10),
          date: bill.date,
          rawAmount: amount,
        };
      });

      return {
        date: daily.date,
        total: dailyTotal,
        income: dailyIncome,
        items,
      };
    });
  }, [getCategoryIcon]);

  const applyTypeAndOrder = useCallback((groups: DailyBillGroup[]) => {
    const sortedGroups = [...groups]
      .map(group => ({ ...group, items: [...group.items] }))
      .sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return orderBy === 'ASC' ? dateA - dateB : dateB - dateA;
      });

    return sortedGroups
      .map(group => {
        const filteredItems = selectedTypeId ? group.items.filter(item => item.typeId === selectedTypeId) : group.items;

        const sortedItems = filteredItems.sort((a, b) => {
          const aTime = /^\d+$/.test(String(a.date)) ? parseInt(String(a.date), 10) : new Date(String(a.date)).getTime();
          const bTime = /^\d+$/.test(String(b.date)) ? parseInt(String(b.date), 10) : new Date(String(b.date)).getTime();
          return orderBy === 'ASC' ? aTime - bTime : bTime - aTime;
        });

        const totals = sortedItems.reduce(
          (acc, item) => {
            const absAmount = Math.abs(item.rawAmount ?? item.amount);
            if (item.payType === 1) {
              acc.total += absAmount;
            } else {
              acc.income += absAmount;
            }
            return acc;
          },
          { total: 0, income: 0 }
        );

        return {
          ...group,
          total: totals.total,
          income: totals.income,
          items: sortedItems,
        };
      })
      .filter(group => group.items.length > 0);
  }, [orderBy, selectedTypeId]);

  // 加载待同步账单列表
  const loadPendingBillsFromStorage = useCallback(async (): Promise<SubItem[]> => {
    try {
      const raw = await AsyncStorage.getItem(PENDING_BILLS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Failed to load pending bills', error);
      return [];
    }
  }, []);

  const savePendingBillsToStorage = useCallback(async (pendingBills: SubItem[]) => {
    try {
      if (pendingBills.length === 0) {
        await AsyncStorage.removeItem(PENDING_BILLS_STORAGE_KEY);
      } else {
        await AsyncStorage.setItem(PENDING_BILLS_STORAGE_KEY, JSON.stringify(pendingBills));
      }
    } catch (error) {
      console.error('Failed to save pending bills', error);
    }
  }, []);

  // 新增/更新待同步账单到 Storage
  const upsertPendingBillToStorage = useCallback(async (bill: SubItem) => {
    // 只有本地账单才需要处理
    if (!bill.localId) return;

    // 先加载当前待同步账单列表，过滤掉当前账单（如果已存在）
    const pendingBills = await loadPendingBillsFromStorage();

    // 如果当前账单的 syncStatus 是 syncing 或 failed，说明是新增或更新操作，需要保留在列表中；如果是 synced，则说明已成功同步，需要从列表中移除
    const nextPendingBills = pendingBills.filter(item => item.localId !== bill.localId);

    // 如果是新增或更新操作，才将账单添加到列表中；如果是 synced，则不添加（相当于删除）
    if (bill.syncStatus === 'failed' || bill.syncStatus === 'syncing') {
      nextPendingBills.unshift(bill);
    }

    // 保存更新后的列表到 Storage
    await savePendingBillsToStorage(nextPendingBills);
  }, [loadPendingBillsFromStorage, savePendingBillsToStorage]);

  const updatePendingBillStatusInStorage = useCallback(async (localId: string, status: SyncStatus) => {
    const pendingBills = await loadPendingBillsFromStorage();
    const targetIndex = pendingBills.findIndex(item => item.localId === localId);
    if (targetIndex < 0) return;

    if (status === 'synced') {
      pendingBills.splice(targetIndex, 1);
    } else {
      pendingBills[targetIndex] = {
        ...pendingBills[targetIndex],
        syncStatus: status,
        ...(status === 'failed' ? {} : { retryParams: undefined })
      };
    }

    await savePendingBillsToStorage(pendingBills);
  }, [loadPendingBillsFromStorage, savePendingBillsToStorage]);

  const mergePendingBills = useCallback((serverData: DailyBillGroup[], pendingBills: SubItem[]) => {
    if (!currentDate || pendingBills.length === 0) {
      return serverData;
    }

    const merged: DailyBillGroup[] = serverData.map(group => ({ ...group, items: [...group.items] }));
    const monthPrefix = `${currentDate}-`;

    pendingBills
      .filter(item => item.localId && (item.syncStatus === 'failed' || item.syncStatus === 'syncing'))
      .filter(item => (selectedTypeId ? item.typeId === selectedTypeId : true))
      .forEach(pending => {
        const dateStr = formatBillDate(String(pending.date));
        if (!dateStr.startsWith(monthPrefix)) return;

        const group = merged.find(g => g.date === dateStr);
        const isExpense = pending.payType === 1;
        const amountAbs = Math.abs(pending.rawAmount ?? pending.amount);

        if (group) {
          if (!group.items.find(i => i.localId === pending.localId)) {
            if (orderBy === 'ASC') {
              group.items.push(pending);
            } else {
              group.items.unshift(pending);
            }
            group.total += isExpense ? amountAbs : 0;
            group.income += isExpense ? 0 : amountAbs;
          }
        } else {
          const newGroup: DailyBillGroup = {
            date: dateStr,
            total: isExpense ? amountAbs : 0,
            income: isExpense ? 0 : amountAbs,
            items: [pending]
          };
          if (orderBy === 'ASC') {
            merged.push(newGroup);
          } else {
            merged.unshift(newGroup);
          }
        }
      });

    return merged;
  }, [currentDate, formatBillDate, orderBy, selectedTypeId]);

  useEffect(() => {
    const loadLastDate = async () => {
      try {
        const savedDate = await AsyncStorage.getItem('lastSelectedDate');
        if (savedDate) {
          setCurrentDate(savedDate);
        } else {
          // 如果没有保存的日期，默认使用当前年月
          const now = new Date();
          setCurrentDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
        }
      } catch (e) {
        console.error('Failed to load date', e);
      }
    };
    loadLastDate();
  }, []);

  const fetchBills = useCallback(async () => {
    // 无currentDate时不发请求，避免重复请求和错误展示；
    if (!currentDate) return;

    // 如果正在加载中，也不发请求，避免重复请求
    if (loadingRef.current) return;

    loadingRef.current = true;
    setRefreshing(true);

    // 先尝试加载离线缓存和待同步账单，确保无论网络状态如何都能展示数据，提升用户体验
    let hasCache = false;
    let pendingBills: SubItem[] = [];
    let finalDataState: DataState = 'online';

    try {
      pendingBills = await loadPendingBillsFromStorage();
      const cachedMonth = await loadBillMonthCache(currentDate);

      if (cachedMonth) {
        hasCache = true;
        setSummary(cachedMonth.summary);

        const transformedCached = transformDailyBills(cachedMonth.list);
        const filteredCached = applyTypeAndOrder(transformedCached);
        const mergedCached = mergePendingBills(filteredCached, pendingBills);
        setData(mergedCached);
        finalDataState = mergedCached.length === 0 ? 'empty' : 'offline-cached';
      }

      const [year, month] = currentDate.split('-');
      const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();

      const start = `${currentDate}-01 00:00:00`;
      const end = `${currentDate}-${lastDay} 23:59:59`;
      const res = await getBillList({
        start,
        end,
        page: 1,
        page_size: 1000,
        orderBy,
        ...(selectedTypeId ? { type_id: selectedTypeId } : {})
      });

      if (res.code === 200) {
        const transformedData = transformDailyBills(res.data.list);
        const filteredData = applyTypeAndOrder(transformedData);
        const mergedData = mergePendingBills(filteredData, pendingBills);

        setSummary({
          totalExpense: res.data.totalExpense,
          totalIncome: res.data.totalIncome,
        });
        setData(mergedData);
        finalDataState = mergedData.length === 0 ? 'empty' : 'online';

        if (!selectedTypeId) {
          await saveBillMonthCache(currentDate, res.data.list, {
            totalExpense: res.data.totalExpense,
            totalIncome: res.data.totalIncome,
          });
        }
      } else if (!hasCache) {
        finalDataState = 'error';
      }
    } catch (error) {
      console.error('Fetch error:', error);

      if (!hasCache) {
        const pendingOnly = mergePendingBills([], pendingBills);
        if (pendingOnly.length > 0) {
          setData(pendingOnly);
          finalDataState = 'offline-cached';
        } else {
          finalDataState = 'error';
        }
      }
    } finally {
      setDataState(finalDataState);
      loadingRef.current = false;
      setRefreshing(false);
    }
  }, [applyTypeAndOrder, currentDate, loadPendingBillsFromStorage, mergePendingBills, orderBy, selectedTypeId, transformDailyBills]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  // 处理自动记账参数
  useEffect(() => {
    if (route.params?.autoBill) {
      const { autoBill } = route.params;
      // 延迟一点以确保组件已渲染，或者直接打开
      setTimeout(() => {
        billFormRef.current?.open({
          amount: autoBill.amount,
          // 暂时使用默认分类，或者你可以根据 autoBill.category 尝试匹配
          category: '1', // 默认分类ID，需根据实际情况调整
          categoryName: '餐饮', // 默认分类名
          date: new Date().toISOString().split('T')[0],
          remark: `[自动识别] ${autoBill.merchant || ''} - ${autoBill.rawText.substring(0, 10)}...`,
          type: autoBill.type === 'expense' ? 1 : 2
        });
      }, 500);
      
      // 清除参数防止重复触发（实际上 React Navigation 的 params 会保留，建议配合 setParams 清除，但这里简单处理）
    }
  }, [route.params]);

  const handleDateConfirm = (year: number, month: number) => {
    const formattedMonth = month.toString().padStart(2, '0');
    const newDate = `${year}-${formattedMonth}`;
    setCurrentDate(newDate);
    AsyncStorage.setItem('lastSelectedDate', newDate).catch(e => console.error('Failed to save date', e));
    setShowPicker(false);
  };

  const handleAdd = () => {
    setEditingId(null);
    billFormRef.current?.open();
  };

  const handleEdit = (id: number) => {
    let targetItem: SubItem | undefined;
    for (const group of data) {
      const item = group.items.find(i => i.id === id);
      if (item) {
        targetItem = item;
        break;
      }
    }
    
    if (targetItem) {
      setEditingId(id);
      // Handle date parsing (supports timestamp string or date string)
      let dateObj: Date;
      const dateVal = String(targetItem.date);
      // If it's a timestamp (all digits)
      if (/^\d+$/.test(dateVal)) {
        dateObj = new Date(parseInt(dateVal, 10));
      } else {
        dateObj = new Date(dateVal);
      }
      
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      billFormRef.current?.open({
        amount: targetItem.rawAmount,
        category: targetItem.typeId,
        categoryName: targetItem.type,
        date: dateStr,
        remark: targetItem.remark,
        type: targetItem.payType
      });
    }
  };

  // 乐观更新: 立即添加本地账单
  const optimisticAddBill = (billData: BillData): SubItem => {
    const localId = generateLocalId();
    const isExpense = billData.type === 1;
    const category = categories.find(c => c.id === billData.category);
    
    return {
      id: -Date.now(), // 临时负ID
      type: billData.categoryName,
      icon: category?.icon || 'icon-qianming',
      remark: billData.remark,
      amount: isExpense ? -billData.amount : billData.amount,
      typeId: billData.category,
      date: new Date(billData.date).getTime().toString(),
      payType: billData.type,
      rawAmount: billData.amount,
      syncStatus: 'syncing',
      localId,
      retryParams: {
        amount: billData.amount.toFixed(2),
        type_id: parseInt(billData.category, 10),
        type_name: billData.categoryName,
        date: new Date(billData.date).getTime(),
        pay_type: billData.type,
        remark: billData.remark || '',
        client_local_id: localId,
      }
    };
  };

  const recalculateGroup = useCallback((date: string, items: SubItem[]): DailyBillGroup => {
    const totals = items.reduce(
      (acc, item) => {
        const amountAbs = Math.abs(item.rawAmount ?? item.amount);
        if (item.payType === 1) {
          acc.total += amountAbs;
        } else {
          acc.income += amountAbs;
        }
        return acc;
      },
      { total: 0, income: 0 }
    );

    return {
      date,
      total: totals.total,
      income: totals.income,
      items,
    };
  }, []);

  const findSubItemById = useCallback((targetId: number): SubItem | undefined => {
    for (const group of data) {
      const matched = group.items.find(item => item.id === targetId);
      if (matched) return matched;
    }
    return undefined;
  }, [data]);

  const buildSubItemFromServer = useCallback((bill: BillDetail): SubItem => {
    const payType = parseInt(String(bill.pay_type), 10);
    const amountAbs = parseFloat(String(bill.amount));

    return {
      id: bill.id,
      type: bill.type_name,
      icon: getCategoryIcon(bill.type_name),
      remark: bill.remark,
      amount: payType === 1 ? -amountAbs : amountAbs,
      typeId: String(bill.type_id),
      date: String(bill.date),
      payType,
      rawAmount: amountAbs,
    };
  }, [getCategoryIcon]);

  const upsertLocalDataItem = useCallback((nextItem: SubItem, matcher: (item: SubItem) => boolean) => {
    setData(prevData => {
      const groups: DailyBillGroup[] = [];

      prevData.forEach(group => {
        const filteredItems = group.items.filter(item => !matcher(item));
        if (filteredItems.length > 0) {
          groups.push(recalculateGroup(group.date, filteredItems));
        }
      });

      if (selectedTypeId && nextItem.typeId !== selectedTypeId) {
        return groups;
      }

      const targetDate = formatBillDate(String(nextItem.date));
      if (!targetDate) return groups;

      const targetIndex = groups.findIndex(group => group.date === targetDate);
      if (targetIndex >= 0) {
        const nextItems = [...groups[targetIndex].items];
        if (orderBy === 'ASC') {
          nextItems.push(nextItem);
        } else {
          nextItems.unshift(nextItem);
        }
        groups[targetIndex] = recalculateGroup(groups[targetIndex].date, nextItems);
      } else {
        const newGroup = recalculateGroup(targetDate, [nextItem]);
        if (orderBy === 'ASC') {
          groups.push(newGroup);
        } else {
          groups.unshift(newGroup);
        }
      }

      return groups;
    });
  }, [formatBillDate, orderBy, recalculateGroup, selectedTypeId]);

  // 更新本地账单状态
  const updateLocalBillStatus = useCallback(async (localId: string, status: SyncStatus) => {
    setData(prevData => {
      return prevData.map(group => ({
        ...group,
        items: group.items.map(item => {
          if (item.localId === localId) {
            return {
              ...item,
              syncStatus: status,
              ...(status === 'failed' ? {} : { retryParams: undefined })
            };
          }
          return item;
        })
      }));
    });

    try {
      await updatePendingBillStatusInStorage(localId, status);
    } catch (error) {
      console.error('Failed to update pending bill status', error);
    }
  }, [updatePendingBillStatusInStorage]);

  // 重试同步
  const handleRetrySync = async (localId: string) => {
    // 找到对应的账单项
    let targetItem: SubItem | undefined;
    for (const group of data) {
      const item = group.items.find(i => i.localId === localId);
      if (item) {
        targetItem = item;
        break;
      }
    }

    if (!targetItem?.retryParams) return;

    // 更新状态为同步中
    await updateLocalBillStatus(localId, 'syncing');

    try {
      const res = await addBill(targetItem.retryParams);
      if (res.code === 200) {
        await updateLocalBillStatus(localId, 'synced');
        if (res.data) {
          const serverId = res.data.id;
          upsertLocalDataItem(buildSubItemFromServer(res.data), item => item.localId === localId || item.id === serverId);
        }
        showToast('同步成功');
      } else {
        await updateLocalBillStatus(localId, 'failed');
        showToast('同步失败,请重试');
      }
    } catch (error) {
      await updateLocalBillStatus(localId, 'failed');
      showToast('同步失败,请重试');
    }
  };

  const retryFailedPendingBills = useCallback(async () => {
    const pendingBills = await loadPendingBillsFromStorage();
    const failedBills = pendingBills.filter(item => item.syncStatus === 'failed' && item.localId && item.retryParams);

    if (failedBills.length === 0) return;

    let hasSynced = false;

    for (const bill of failedBills) {
      if (!bill.localId || !bill.retryParams) continue;

      await updateLocalBillStatus(bill.localId, 'syncing');
      try {
        const res = await addBill(bill.retryParams);
        if (res.code === 200) {
          await updateLocalBillStatus(bill.localId, 'synced');
          if (res.data) {
            const serverId = res.data.id;
            upsertLocalDataItem(buildSubItemFromServer(res.data), item => item.localId === bill.localId || item.id === serverId);
          }
          hasSynced = true;
        } else {
          await updateLocalBillStatus(bill.localId, 'failed');
        }
      } catch (error) {
        await updateLocalBillStatus(bill.localId, 'failed');
      }
    }

    if (hasSynced) {
      showToast('离线账单已自动同步');
    }
  }, [buildSubItemFromServer, loadPendingBillsFromStorage, updateLocalBillStatus, upsertLocalDataItem]);

  useEffect(() => {
    retryFailedPendingBills();
  }, [currentDate, retryFailedPendingBills]);

  const showToast = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert('提示', message);
    }
  };

  const handleBillSubmit = async (billData: BillData) => {
    // 防止重复提交
    if (isSubmitting) return;

    // 将日期转换为时间戳（毫秒）
    const timestamp = new Date(billData.date).getTime();
    const params = {
      amount: billData.amount.toFixed(2),
      type_id: parseInt(billData.category, 10),
      type_name: billData.categoryName,
      date: timestamp,
      pay_type: billData.type,
      remark: billData.remark || ''
    };

    if (editingId) {
      const previousData = data;
      const previousSummary = summary;
      const oldItem = findSubItemById(editingId);
      const category = categories.find(c => c.id === billData.category);
      const optimisticEditedItem: SubItem = {
        id: editingId,
        type: billData.categoryName,
        icon: category?.icon || 'icon-qianming',
        remark: billData.remark,
        amount: billData.type === 1 ? -billData.amount : billData.amount,
        typeId: billData.category,
        date: timestamp.toString(),
        payType: billData.type,
        rawAmount: billData.amount,
      };

      if (oldItem) {
        const oldExpense = oldItem.payType === 1 ? Math.abs(oldItem.rawAmount ?? oldItem.amount) : 0;
        const oldIncome = oldItem.payType === 2 ? Math.abs(oldItem.rawAmount ?? oldItem.amount) : 0;
        const newExpense = billData.type === 1 ? billData.amount : 0;
        const newIncome = billData.type === 2 ? billData.amount : 0;

        setSummary(prev => ({
          totalExpense: prev.totalExpense - oldExpense + newExpense,
          totalIncome: prev.totalIncome - oldIncome + newIncome,
        }));
        upsertLocalDataItem(optimisticEditedItem, item => item.id === editingId);
      }

      setIsSubmitting(true);
      try {
        const res = await updateBill({ ...params, id: editingId });
        if (res.code !== 200) {
          throw new Error(res.msg || '修改失败');
        }

        if (res.data) {
          const serverId = res.data.id;
          upsertLocalDataItem(buildSubItemFromServer(res.data), item => item.id === editingId || item.id === serverId);
        }
      } catch (error: any) {
        setData(previousData);
        setSummary(previousSummary);
        Alert.alert('错误', error.message || '修改失败');
      } finally {
        setIsSubmitting(false);
        setEditingId(null);
      }

      return;
    }

    // 新增模式: 乐观更新
    const localBill = optimisticAddBill(billData);
    const shouldShowInCurrentFilter = !selectedTypeId || selectedTypeId === localBill.typeId;

    if (shouldShowInCurrentFilter) {
      upsertLocalDataItem(localBill, item => item.localId === localBill.localId);
    }

    // 将本地账单保存到 Storage，以便离线时展示和后续重试
    upsertPendingBillToStorage(localBill).catch(error => {
      console.error('Failed to persist local bill', error);
    });

    // 更新统计
    setSummary(prev => ({
      totalExpense: billData.type === 1 ? prev.totalExpense + billData.amount : prev.totalExpense,
      totalIncome: billData.type === 2 ? prev.totalIncome + billData.amount : prev.totalIncome,
    }));

    try {
      const res = await addBill({ ...params, client_local_id: localBill.localId });
      if (res.code === 200) {
        await updateLocalBillStatus(localBill.localId!, 'synced');

        if (res.data) {
          const matchedLocalId = res.data.client_local_id || localBill.localId;
          const serverId = res.data.id;
          upsertLocalDataItem(buildSubItemFromServer(res.data), item => item.localId === matchedLocalId || item.localId === localBill.localId || item.id === serverId);
        }
      } else {
        await updateLocalBillStatus(localBill.localId!, 'failed');
        showToast('账单保存失败,点击可重试');
      }
    } catch (error) {
      await updateLocalBillStatus(localBill.localId!, 'failed');
      showToast('账单保存失败,点击可重试');
    }

    setEditingId(null);
  };

  const renderBillItem = ({ item }: { item: DailyBillGroup }) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionDate}>{item.date}</Text>
        <Text style={styles.sectionStat}>支出: ￥{item.total.toFixed(2)} 收入: ￥{item.income.toFixed(2)}</Text>
      </View>
      {item.items.map((subItem: SubItem, index: number) => (
        <BillItem
          key={subItem.localId || subItem.id}
          {...subItem}
          onDeleteSuccess={onRefresh}
          onEdit={handleEdit}
          onRetry={handleRetrySync}
          isLast={index === item.items.length - 1}
        />
      ))}
    </View>
  );

  const onRefresh = async () => {
    await fetchBills();
    await retryFailedPendingBills();
  };

  return (
    <View style={styles.root}>
      {dataState === 'offline-cached' && (
        <View style={[styles.offlineBanner, { paddingTop: insets.top + 6 }]}>
          <Text style={styles.offlineBannerText}>当前离线，展示缓存账单</Text>
        </View>
      )}

      {/* 顶部统计栏 */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.headerLabel}>总支出：</Text>
          <Text style={styles.headerValue}>{summary.totalExpense.toFixed(2)}</Text>
          <Text style={styles.headerLabel}>总收入：</Text>
          <Text style={styles.headerValue}>{summary.totalIncome.toFixed(2)}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.headerBtn} 
            onPress={() => {
              if (loadingRef.current) {
                return;
              }
              setOrderBy(prev => prev === 'ASC' ? 'DESC' : 'ASC');
            }}
          >
            <Text style={styles.headerBtnText}>{orderBy === 'ASC' ? '正序' : '倒序'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setShowTypePicker(true)}>
            <Text style={styles.headerBtnText}>
              {selectedTypeId ? categories.find(c => c.id === selectedTypeId)?.name || '全部类型' : '全部类型'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setShowPicker(true)}>
            <Text style={styles.headerBtnText}>{currentDate}</Text>
          </TouchableOpacity>
        </View>
      </View>
      {/* 账单列表 */}
      <FlatList
        style={styles.scroll}
        contentContainerStyle={[styles.flatListContent, { paddingBottom: 80 + insets.bottom }]}
        data={data}
        renderItem={renderBillItem}
        keyExtractor={(item) => item.date}
        showsVerticalScrollIndicator={false}
        onRefresh={onRefresh}
        refreshing={refreshing}
        ListEmptyComponent={!refreshing ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {dataState === 'error' ? '加载失败，请下拉重试' : '暂无账单数据'}
            </Text>
          </View>
        ) : null}
        // 使用三元运算符，refreshing 为 true 时显示加载指示器，否则返回 null
        ListFooterComponent={refreshing ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#0090FF" />
          </View>
        ) : null}
      />
      {/* 底部菜单栏 - 已移动到 Main 组件 */}
      
      <MonthYearPicker
        visible={showPicker}
        currentDate={currentDate}
        onClose={() => setShowPicker(false)}
        onConfirm={handleDateConfirm}
      />

      <TypePicker
        visible={showTypePicker}
        selectedTypeId={selectedTypeId}
        categories={categories}
        getCategoryIcon={getCategoryIcon}
        onClose={() => setShowTypePicker(false)}
        onSelect={setSelectedTypeId}
        footerHeight={insets.bottom > 0 ? insets.bottom : 16}
      />

      <View style={[styles.fabContainer, { bottom: 40 + insets.bottom }]}>
        <TouchableOpacity style={styles.fab} onPress={handleAdd}>
          <CategoryIcon style={styles.fabIcon} icon={'icon-qianming'} size={22} />
        </TouchableOpacity>
        <BillForm ref={billFormRef} onSubmit={handleBillSubmit} />
      </View>

      {isSubmitting && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>正在提交...</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background.neutral },
  offlineBanner: {
    backgroundColor: '#FFF4E5',
    alignItems: 'center',
    paddingBottom: 8,
  },
  offlineBannerText: {
    color: '#8A4B00',
    fontSize: 12,
    fontWeight: '600',
  },
  fabContainer: {
    position: 'absolute',
    right: 20,
    zIndex: 100,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    opacity: 0.65,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  fabIcon: {
    color: theme.colors.text.inverse,
  },
  header: {
    backgroundColor: theme.colors.primary,
    paddingBottom: 14,
    paddingHorizontal: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 8
  },
  headerLabel: { color: theme.colors.text.inverse, fontSize: theme.typography.size.md },
  headerValue: { color: theme.colors.text.inverse, fontSize: theme.typography.size.xl, fontWeight: 'bold', marginRight: 24 },

  headerActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  headerBtn: {
    backgroundColor: theme.colors.btn,
    borderRadius: 8,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    marginLeft: 8
  },
  headerBtnText: { color: theme.colors.text.inverse, fontSize: theme.typography.size.md },

  flatListContent: { paddingBottom: 80 },
  scroll: { flex: 1, marginTop: 0 },
  section: { backgroundColor: theme.colors.background.paper, borderRadius: 12, marginHorizontal: theme.spacing.md, marginTop: 16, paddingBottom: 8, elevation: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  sectionDate: { fontWeight: 'bold', fontSize: 16, color: theme.colors.text.primary },
  sectionStat: { fontSize: 12, color: theme.colors.text.secondary },
  loaderContainer: {
    paddingVertical: 20
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    color: theme.colors.text.secondary,
    fontSize: 14,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingBox: {
    backgroundColor: theme.colors.background.paper,
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 5,
  },
  loadingText: {
    marginTop: 10,
    color: theme.colors.text.primary,
    fontSize: 14,
  },
});

export default List;