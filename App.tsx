import React from 'react';
import { StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Login from './pages/Login';
import Main from './pages/Main';
import CategoryEdit from './pages/CategoryEdit';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
// 导入公共类型定义
import { RootStackParamList } from './types/navigation';
import { navigationRef } from './utils/navigationRef';
import { CategoryProvider } from './context/CategoryContext';
import { UserProvider } from './context/UserContext';

const Stack = createNativeStackNavigator<RootStackParamList>();

function AuthLoading({ navigation }: { navigation: NativeStackNavigationProp<any> }) {
  React.useEffect(() => {
    const checkToken = async () => {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        navigation.replace('Main');
      } else {
        navigation.replace('Login');
      }
    };
    checkToken();
  }, [navigation]);
  return null;
}

function App() {
  console.log('App is running with Expo support!', Constants.deviceName);

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <CategoryProvider>
          <UserProvider>
            <NavigationContainer ref={navigationRef}>
            <Stack.Navigator 
              initialRouteName="AuthLoading" 
              screenOptions={{ 
                headerShown: false,
                animation: 'flip'
              }}
            >
              <Stack.Screen name="AuthLoading" component={AuthLoading} />
              <Stack.Screen name="Login" component={Login} />
              <Stack.Screen name="Main" component={Main} />
              <Stack.Screen 
                name="CategoryEdit" 
                component={CategoryEdit}
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
            </Stack.Navigator>
            </NavigationContainer>
          </UserProvider>
        </CategoryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;