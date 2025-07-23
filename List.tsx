import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const List = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Welcome List</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  text: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
});

export default List; 