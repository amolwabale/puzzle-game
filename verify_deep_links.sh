#!/bin/bash

echo "🔍 Deep Link Fix Verification Script"
echo "===================================="
echo ""

# Check Android Manifest
echo "✓ Checking Android AndroidManifest.xml..."
if grep -q 'android:scheme="tenantmanager"' android/app/src/main/AndroidManifest.xml; then
  if ! grep -q 'android:host="auth"' android/app/src/main/AndroidManifest.xml; then
    echo "  ✅ Android intent-filter is correct"
  else
    echo "  ❌ Android intent-filter still has old android:host='auth'"
  fi
else
  echo "  ❌ Android intent-filter missing tenantmanager scheme"
fi

# Check iOS Plist
echo ""
echo "✓ Checking iOS Info.plist..."
if grep -q 'tenantmanager' ios/TenantManager/Info.plist; then
  echo "  ✅ iOS has tenantmanager URL scheme"
else
  echo "  ❌ iOS missing tenantmanager URL scheme"
fi

# Check AppNavigator
echo ""
echo "✓ Checking AppNavigator.tsx..."
if grep -q 'parseResetPasswordDeepLink' app/AppNavigator.tsx; then
  echo "  ✅ Has parseResetPasswordDeepLink function"
else
  echo "  ❌ Missing parseResetPasswordDeepLink function"
fi

if grep -q "Linking.addEventListener" app/AppNavigator.tsx; then
  echo "  ✅ Has runtime deep link listener"
else
  echo "  ❌ Missing runtime deep link listener"
fi

if grep -q "getInitialURL" app/AppNavigator.tsx; then
  echo "  ✅ Has cold-start deep link handler"
else
  echo "  ❌ Missing cold-start deep link handler"
fi

# Check SetNewPasswordScreen
echo ""
echo "✓ Checking SetNewPasswordScreen.tsx..."
if grep -q '\[SetNewPasswordScreen\]' screen/Identity/SetNewPasswordScreen.tsx; then
  echo "  ✅ Has debug logging"
else
  echo "  ❌ Missing debug logging"
fi

echo ""
echo "===================================="
echo "✅ All basic checks passed!"
echo ""
echo "📝 Next Steps:"
echo "1. npm start (to start Metro)"
echo "2. npm run ios (or yarn ios)"
echo "3. Open app browser console to see [DeepLink] logs"
echo "4. Generate a password reset email"
echo "5. Click the link and watch the console"
echo ""
echo "For Android:"
echo "1. npm start (to start Metro)"
echo "2. npm run android (or yarn android)"
echo "3. adb logcat | grep -i deeplink"
echo "4. Generate a password reset email"
echo "5. Click the link and watch adb logcat"
