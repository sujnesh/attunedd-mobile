import React, { useEffect, useState } from 'react';
import { StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initializeDatabase } from './src/db/database';
import { initializeBackgroundSystem } from './src/state/backgroundBridge';
import AppNavigator from './src/navigation/AppNavigator';

function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const boot = async () => {
      await initializeDatabase();
      await initializeBackgroundSystem();
      setReady(true);
    };
    boot().catch(console.error);
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      {ready ? <AppNavigator /> : <View style={{ flex: 1, backgroundColor: '#0A0A0A' }} />}
    </SafeAreaProvider>
  );
}

export default App;
