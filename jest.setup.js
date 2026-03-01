jest.mock('react-native-background-fetch', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    scheduleTask: jest.fn(),
    finish: jest.fn(),
    STATUS_AVAILABLE: 2,
    NETWORK_TYPE_NONE: 0,
  },
}));

jest.mock('react-native-sqlite-storage', () => ({
  openDatabase: jest.fn(() => ({
    executeSql: jest.fn(),
  })),
  enablePromise: jest.fn(),
}));

jest.mock('react-native-push-notification', () => ({
  configure: jest.fn(),
  createChannel: jest.fn(),
  localNotification: jest.fn(),
}));

jest.mock('@react-native-community/push-notification-ios', () => ({}));

jest.mock('react-native-health', () => ({
  __esModule: true,
  default: {
    initHealthKit: jest.fn((_opts, cb) => cb(null)),
    isAvailable: jest.fn((cb) => cb(null, true)),
    getAuthStatus: jest.fn((_opts, cb) => cb(null, { permissions: { read: [2, 2, 2] } })),
    getSamples: jest.fn((_opts, cb) => cb(null, [])),
    getHeartRateSamples: jest.fn((_opts, cb) => cb(null, [])),
    Constants: {
      Permissions: {
        Workout: 'Workout',
        HeartRate: 'HeartRate',
        DistanceWalkingRunning: 'DistanceWalkingRunning',
      },
    },
  },
}));

jest.mock('react-native-health-connect', () => ({
  initialize: jest.fn(),
  requestPermission: jest.fn(),
  readRecords: jest.fn(),
}));

jest.mock('react-native-screens', () => ({
  enableScreens: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }) => children,
  SafeAreaView: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
}));

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    NavigationContainer: ({ children }) => children,
    useFocusEffect: (cb) => React.useEffect(() => { cb(); }, [cb]),
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
    useRoute: () => ({ params: {} }),
  };
});

jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: ({ children }) => children,
    Screen: ({ children }) => children,
  }),
}));

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children }) => children,
    Screen: ({ children }) => children,
  }),
}));
