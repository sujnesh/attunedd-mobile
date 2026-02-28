module.exports = {
  preset: 'react-native',
  setupFiles: ['./jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-background-fetch|react-native-sqlite-storage|react-native-health|react-native-health-connect|react-native-push-notification|@react-native-community/push-notification-ios|react-native-safe-area-context)/)',
  ],
};
