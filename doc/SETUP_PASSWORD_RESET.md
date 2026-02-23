# 🔐 Password Reset - Supabase Configuration Checklist

## ✅ QUICK SETUP (5 minutes)

### Step 1: Supabase Dashboard Configuration

1. **Go to your Supabase Project → Authentication → URL Configuration**

2. **Add Redirect URL:**
   ```
   tenantmanager://reset-password
   ```

3. **For Development (Optional):**
   ```
   capillary://reset-password
   exp://localhost:8081
   ```

4. **Click "Save"**

### Step 2: Verify Email Template

1. **Go to Authentication → Email Templates**
2. **Find "Password Reset" email template**
3. **Verify it contains:** `{{ .ConfirmationURL }}`
4. **Subject should contain password reset context**

Example template should include:
```
Click this link to reset your password:
{{ .ConfirmationURL }}

This link expires in 1 hour.
```

### Step 3: Email Provider Configuration

Ensure your email provider is connected:
- SendGrid (recommended)
- AWS SES
- Custom SMTP

Check: Authentication → Email Templates → Test (send test email to yourself)

### Step 4: Test the Flow (Android)

```bash
# Build and run
npm run android

# On emulator:
1. Tap "Forgot Password?"
2. Enter test email
3. See success message
4. Check email in web browser (if real email)
```

### Step 5: Test Deep Link (Android)

```bash
# If you have a real registered email, test the link:
adb shell am start -a android.intent.action.VIEW \
  -d "tenantmanager://reset-password?access_token=YOUR_TOKEN&refresh_token=YOUR_TOKEN"
```

---

## 🔧 Platform-Specific Configuration

### iOS Deep Link Configuration

**File:** `ios/TenantManager/Info.plist`

Add to root of plist (if not already present):

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>io.tenant.manager</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>tenantmanager</string>
    </array>
  </dict>
</array>
```

**Build & Run:**
```bash
npm run ios
```

### Android Deep Link Configuration

**File:** `android/app/src/main/AndroidManifest.xml`

Already configured via React Navigation, but verify:

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="tenantmanager" android:host="*" />
</intent-filter>
```

---

## 🚀 Production Deployment

### Pre-Launch Checklist

- [ ] Supabase Redirect URL configured: `tenantmanager://reset-password`
- [ ] Email provider connected and tested
- [ ] Password Reset email template customized (optional but recommended)
- [ ] Deep link scheme registered (iOS: Info.plist, Android: auto-configured)
- [ ] Test email-to-app flow end-to-end
- [ ] Analytics enabled to track password resets
- [ ] Error logging configured (Sentry, Firebase Crashlytics)

### Environment Variables (if needed)

```bash
# .env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
GOOGLE_WEB_CLIENT_ID=your-google-web-client-id
GOOGLE_IOS_CLIENT_ID=your-google-ios-client-id
```

### Monitoring

Watch these analytics events in your dashboard:

```
Auth_ResetPassword_Sent
Auth_ResetPasswordDeepLink_Success
Auth_PasswordReset_Success
Auth_PasswordReset_Cancelled
```

---

## 🐛 Troubleshooting

### "Email not received"

**Check:**
1. Email provider connected in Supabase
2. Email template has `{{ .ConfirmationURL }}`
3. Check spam/junk folder
4. Verify email address is registered

**Solutions:**
- Re-send reset link
- Check Supabase Auth logs for errors
- Test email provider directly

### "Deep link not opening app"

**Check:**
1. Redirect URL added in Supabase
2. Got full app restart after configuration
3. Deep link scheme in Info.plist (iOS)

**Solutions:**
```bash
# Full rebuild
npm run android -- --reset-cache

# Or iOS
cd ios && rm -rf build Pods && pod install && cd ..
npm run ios
```

### "Session Expired" on password update

**Reason:** Reset link tokens expire (typically 24-48 hours)

**Solution:** User requests new reset link

### "Password update failed silently"

**Check:**
1. Supabase Auth → Policies → Password policy settings
2. User has valid session
3. App logs for error messages

**Debug:**
```typescript
// In SetNewPasswordScreen, check session
const { data: { session } } = await supabase.auth.getSession();
console.log('Current session:', session?.user?.id);
```

---

## 📧 Email Customization (Optional)

To customize the password reset email:

1. **Go to:** Supabase Dashboard → Authentication → Email Templates
2. **Select:** Password Reset
3. **Edit HTML/Text:**

```html
<!-- Example custom template -->
<h1>Reset Your Password</h1>
<p>Hi {{ .Email }},</p>
<p>Click the link below to reset your password:</p>
<a href="{{ .ConfirmationURL }}">Reset Password</a>
<p style="color: #999; font-size: 12px;">
  This link expires in 1 hour. If you didn't request 
  this, ignore this email.
</p>
```

4. **Save Changes**
5. **Test by requesting a reset**

---

## 🔐 Security Notes

✅ **Implemented:**
- Never logs passwords
- Generic success message (prevents email enumeration)
- Secure token handling
- Session validation
- HTTPS only (Supabase enforced)

✅ **Best Practices:**
- Change password? Session automatically invalidated
- Tokens expire after 24 hours
- PKCE flow for mobile (secure)
- No password in error messages

---

## 📞 Support

For issues:
1. Check Supabase Docs: https://supabase.com/docs/guides/auth
2. Review `docs/PASSWORD_RESET_IMPLEMENTATION.ts` in this repo
3. Check console logs and Supabase Auth logs

---

**Last Updated:** 2026-02-22
