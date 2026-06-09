import AsyncStorage from '@react-native-async-storage/async-storage';

declare global {
  var storage: typeof AsyncStorage;
}