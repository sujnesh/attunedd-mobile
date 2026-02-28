import { Platform } from 'react-native';
import PushNotification from 'react-native-push-notification';

const CHANNEL_ID = 'attunedd-readiness';

export function configureNotifications(): void {
  PushNotification.configure({
    onNotification: function (_notification: any) {},
    onRegistrationError: function (_err: any) {},
    permissions: {
      alert: true,
      badge: true,
      sound: true,
    },
    popInitialNotification: false,
    requestPermissions: Platform.OS === 'ios',
  });

  PushNotification.createChannel(
    {
      channelId: CHANNEL_ID,
      channelName: 'Training Readiness',
      channelDescription: 'Training readiness state updates',
      importance: 3,
      vibrate: false,
    },
    () => {}
  );
}

export async function sendNotification(
  reason: string,
  score: number,
  band: string
): Promise<void> {
  const body = formatBody(reason, score, band);

  PushNotification.localNotification({
    channelId: CHANNEL_ID,
    title: 'Training Readiness Updated',
    message: body,
    playSound: false,
    ...(Platform.OS === 'ios' ? { userInfo: { score, band } } : { data: { score, band } }),
  });
}

function formatBody(reason: string, score: number, band: string): string {
  const bandLabel = band.charAt(0).toUpperCase() + band.slice(1);
  return `Score: ${score}/100 (${bandLabel}). ${reason}`;
}
