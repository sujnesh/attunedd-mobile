import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import { initializeDatabase } from './src/db/database';
import { initializeBackgroundSystem } from './src/state/backgroundBridge';
import DashboardScreen from './src/screens/DashboardScreen';

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
      {ready && <DashboardScreen />}
    </SafeAreaProvider>
  );
}

export default App;
