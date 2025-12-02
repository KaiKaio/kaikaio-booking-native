import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import TabBar from './TabBar';
import List from './List';
import Account from './Account';

const Main = () => {
  const [activeTab, setActiveTab] = useState('List');

  return (
    <View style={styles.container}>
      <View style={[styles.content, activeTab === 'List' ? styles.active : styles.hidden]}>
        <List />
      </View>
      
      <View style={[styles.content, activeTab === 'Account' ? styles.active : styles.hidden]}>
        <Account />
      </View>

      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F8FA',
  },
  content: {
    flex: 1,
  },
  active: {
    display: 'flex',
  },
  hidden: {
    display: 'none',
  },
});

export default Main;
