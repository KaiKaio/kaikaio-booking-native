import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import TabBar from './TabBar';

const Account = () => {
  return (
    <View style={styles.container}>
      <Text>Account</Text>
      <TabBar />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default Account;