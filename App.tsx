import React from 'react';
import Login from './pages/Login';
import Main from './pages/Main';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
// 导入公共类型定义
import { RootStackParamList } from './types/navigation';

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

import { navigationRef } from './utils/navigationRef';
import { CategoryProvider } from './context/CategoryContext';

function App() {
  return (
    <CategoryProvider>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator initialRouteName="AuthLoading" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="AuthLoading" component={AuthLoading} />
          <Stack.Screen name="Login" component={Login} />
          <Stack.Screen name="Main" component={Main} />
        </Stack.Navigator>
      </NavigationContainer>
    </CategoryProvider>
  );
}

export default App;