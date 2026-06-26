Icon replacement instructions

I created two SVG assets in `assets/`:
- `assets/sliding-puzzle-icon.svg` — compact 1024×1024 app icon vector
- `assets/sliding-puzzle-splash.svg` — tall splash/vector art for launch screen

To use these as native app icons and launch images, convert them to PNGs at the required sizes and replace the existing platform assets.

Android (mipmap):
1. Install ImageMagick (`brew install imagemagick`) or use the Android Asset Studio web UI.
2. From the project root, generate multiple sizes (example for one 512→adaptive mipmap set):

```bash
# create a 1024x1024 PNG (square) from the SVG
magick convert -background none assets/sliding-puzzle-icon.svg -resize 1024x1024 assets/icon-1024.png

# generate mipmap densities
magick convert assets/icon-1024.png -resize 48x48  android/app/src/main/res/mipmap-mdpi/ic_launcher.png
magick convert assets/icon-1024.png -resize 72x72  android/app/src/main/res/mipmap-hdpi/ic_launcher.png
magick convert assets/icon-1024.png -resize 96x96  android/app/src/main/res/mipmap-xhdpi/ic_launcher.png
magick convert assets/icon-1024.png -resize 144x144 android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png
magick convert assets/icon-1024.png -resize 192x192 android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png

# (optional) create round icons if you need ic_launcher_round.png too
cp android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png
```

3. If your project uses adaptive icons (recommended), create a foreground PNG and an XML adaptive icon. You can place the foreground PNG into `drawable/ic_foreground.png` and create `mipmap-anydpi-v26/ic_launcher.xml` pointing to foreground/background.

iOS (AppIcon):
1. Use `assets/sliding-puzzle-icon.svg` converted to PNGs at sizes specified by Xcode (e.g., 20@1x/2x/3x, 29@1x/2x/3x, 40, 60, 76, 83.5, 1024). A helper script or `iconutil` may be used.
2. Replace `Images.xcassets/AppIcon.appiconset/*` PNGs with generated ones and update the Contents.json.

Launch screen:
- If you use `react-native-bootsplash` or a native splash, replace the native launch image resources (Android: `drawable/launch_screen.png` or `bootsplash` assets; iOS: LaunchImage/Storyboards) with PNGs generated from `assets/sliding-puzzle-splash.svg`.

Quick test in Android emulator (use DebugView to confirm events still work):
```bash
# install app on emulator then enable debug analytics
adb shell setprop debug.firebase.analytics.app com.mixmind.slidingpuzzle
adb logcat -s FA FA-SVC | sed -n '1,200p'
```

If you want, I can:
- Generate PNGs for common Android mipmap sizes here and place them into `android/app/src/main/res/` automatically (I can create the files, but you'll need to verify visuals locally).  
- Or produce a plist/Contents.json and sample `AppIcon.appiconset` entries for iOS (you'll still need to supply real PNGs or let me generate them from the SVG).

Which option do you prefer? (A) I generate Android mipmap PNGs for you from the SVG now, or (B) I only add instructions and leave the native replacement to you.  
