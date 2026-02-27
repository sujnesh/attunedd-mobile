import React, { useEffect } from 'react';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  StatusBar,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { initializeBackgroundSystem } from './src/state/backgroundBridge';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  useEffect(() => {
    initializeBackgroundSystem().catch(console.error);
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent isDarkMode={isDarkMode} />
    </SafeAreaProvider>
  );
}

function AppContent({ isDarkMode }: { isDarkMode: boolean }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
        },
      ]}>
      <Text style={[styles.title, { color: isDarkMode ? '#fff' : '#000' }]}>
        Attunedd Mobile
      </Text>
      <Text
        style={[styles.subtitle, { color: isDarkMode ? '#aaa' : '#666' }]}>
        Background system initialized
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 16,
    marginTop: 8,
  },
});

export default App;
