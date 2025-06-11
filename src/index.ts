import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { parseISO, subMinutes } from 'date-fns';

admin.initializeApp();

export const checkScheduledNotifications = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async (context) => {
    const now = new Date();
    const notificationsRef = admin.database().ref('notifications');
    
    // Get all scheduled notifications
    const snapshot = await notificationsRef
      .orderByChild('scheduledTime')
      .endAt(now.toISOString())
      .once('value');

    const notifications = snapshot.val();
    if (!notifications) return null;

    const promises = Object.keys(notifications).map(async (notificationId) => {
      const notification = notifications[notificationId];
      
      // Skip if already sent or cancelled
      if (notification.status !== 'scheduled') return;

      // Get FCM tokens for all recipients
      const tokens: string[] = [];
      for (const userId of notification.recipientIds) {
        const userSnapshot = await admin.database().ref(`users/${userId}/fcmToken`).once('value');
        const token = userSnapshot.val();
        if (token) tokens.push(token);
      }

      if (tokens.length === 0) return;

      // Send push notification
      const message = {
        notification: {
          title: notification.title,
          body: notification.body,
        },
        tokens: tokens,
      };

      try {
        await admin.messaging().sendMulticast(message);
        console.log('Notification sent successfully');
        
        // Update notification status
        await notificationsRef.child(notificationId).update({
          status: 'sent',
          sentAt: now.toISOString(),
        });
      } catch (error) {
        console.error('Error sending notification:', error);
      }
    });

    await Promise.all(promises);
    return null;
  });