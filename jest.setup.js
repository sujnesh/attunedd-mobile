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
  default: {
    initHealthKit: jest.fn(),
    getSamples: jest.fn(),
    getHeartRateSamples: jest.fn(),
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

jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }) => children,
  useFocusEffect: jest.fn(),
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({ params: {} }),
}));

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
