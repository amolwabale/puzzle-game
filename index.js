/**
 * @format
 */

import { AppRegistry } from 'react-native';
import {
  getCrashlytics,
  recordError,
  setAttribute,
} from '@react-native-firebase/crashlytics';
import App from './App';
import { name as appName } from './app.json';

// Record uncaught JS errors to Crashlytics (native crashes are captured automatically).
try {
  const defaultHandler =
    global?.ErrorUtils?.getGlobalHandler?.() ??
    ((err, _isFatal) => {
      console.error(err);
    });
  if (global?.ErrorUtils?.setGlobalHandler) {
    global.ErrorUtils.setGlobalHandler((err, isFatal) => {
      try {
        const crash = getCrashlytics();
        recordError(crash, err);
        setAttribute(crash, 'js_fatal', isFatal ? 'true' : 'false');
      } catch {}
      defaultHandler(err, isFatal);
    });
  }
} catch {
  // If ErrorUtils changes, skip hooking.
}

// Android dev: prevent AuthSessionMissingError from surfacing as an unhandled-promise redbox.
// We still keep the default RN behavior for all other unhandled rejections.
if (__DEV__) {
  try {
    const { Platform, Alert } = require('react-native');
    if (Platform.OS === 'android') {
      const rejectionTracking = require('promise/setimmediate/rejection-tracking');
      const globalHandler =
        global?.ErrorUtils?.getGlobalHandler?.() ??
        ((err, _isFatal) => {
          // Fallback: at least surface it in logs.
          console.error(err);
        });

      rejectionTracking.enable({
        allRejections: true,
        onUnhandled: (id, rejection) => {
          const name = rejection?.name;
          const msg = rejection?.message ?? String(rejection ?? '');

          if (name === 'AuthSessionMissingError' || msg.includes('Auth session missing')) {
            // Show a friendly message instead of a redbox toast.
            Alert.alert('Session missing', 'Please login again.');
            return;
          }

          let message = '';
          try {
            message =
              Object.prototype.toString.call(rejection) === '[object Error]'
                ? Error.prototype.toString.call(rejection)
                : require('pretty-format').format(rejection);
          } catch {
            message = typeof rejection === 'string' ? rejection : JSON.stringify(rejection);
          }

          globalHandler(
            new Error(
              `Uncaught (in promise, id: ${id})${message ? `: "${message}"` : ''}`,
              { cause: rejection },
            ),
            false,
          );
        },
        onHandled: id => {
          console.warn(
            `Promise rejection handled (id: ${id})\n` +
              'This means you can ignore any previous messages of the form ' +
              `"Uncaught (in promise, id: ${id})"`,
          );
        },
      });
    }
  } catch {
    // If the internal modules change, skip overriding.
  }
}

AppRegistry.registerComponent(appName, () => App);
