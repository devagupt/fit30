# Fit30

Fit30 guides you through the original 30-day gym plan, one exercise at a time. It keeps workouts, measurements, and settings in the browser on your device.

## Run on your computer

Install [Node.js 24 LTS](https://nodejs.org/en/download), open a terminal in this folder, and run the following commands.

```sh
npm ci
npm run dev
```

Open [Fit30 on localhost](http://localhost:5173) and choose the date for Day 1. To test installation and offline loading on this computer, run the production preview and open [the preview on localhost](http://localhost:4173).

```sh
npm run build
npm run preview
```

## Install Fit30 with offline reminders

The standalone Android and iPhone builds include the workout plan, photos, and movement guides. The phone schedules reminders for upcoming workouts in the active program using the saved time zone. In **Settings → Reminders and alerts → Daily reminders**, pick a time, tap **Enable reminders**, and allow notifications. Recovery reminders are optional. Fit30 updates its reminders after a schedule change or a finished workout.

If you already use the Home Screen web app, open **Settings → Backup and export → Download JSON backup** there. In the standalone app, choose **Restore backup** on the welcome screen and select that file. Your existing workout history travels with the backup. Enable reminders in the standalone app after importing.

### Build the Android installer

Install JDK 21 and the Android SDK with API 36 using Android Studio. Set `JAVA_HOME` to your JDK and `ANDROID_HOME` to your SDK. [Capacitor Android setup](https://capacitorjs.com/docs/getting-started/environment-setup#android-requirements)

```sh
npm ci
npm run build:android
```

Transfer `android/app/build/outputs/apk/debug/app-debug.apk` to your phone and open it from Downloads or Files. When Android asks, allow that source to install the APK. Once installed, Fit30 and its daily reminders work offline. If Android offers **Allow precise timing** in Fit30, you can give Fit30 **Alarms & reminders** permission. Otherwise, Android may deliver the reminder after the selected time.

Rebuild updates with the same local signing key to install over the existing copy. If this project has an `android/fit30-debug.keystore` file, Gradle uses it for debug APKs. Keep that file private.

### Build the iPhone app

Install Xcode 26 or later on your Mac. Run the following in the project folder, select the **App** scheme and your iPhone in Xcode, then choose your signing team under **Signing & Capabilities** and run the app. [Capacitor iOS setup](https://capacitorjs.com/docs/getting-started/environment-setup#ios-requirements) · [Apple device setup](https://developer.apple.com/documentation/xcode/running-your-app-in-simulator-or-on-a-device)

```sh
npm ci
npm run open:ios
```

## Try it on your phone

Connect the computer and phone to the same Wi-Fi. Stop any running preview with **Control+C**, then run the following from the project folder.

```sh
npm run build
npm run preview -- --host 0.0.0.0
```

On your phone, open the **Network** URL printed in the terminal. Use Safari on iPhone or Chrome on Android. This works while the Mac and phone can reach each other. For offline use, set up Fit30 once using Android port forwarding over USB or Wi-Fi, or use trusted HTTPS. [Service Workers specification](https://www.w3.org/TR/service-workers/)

### Install on iPhone

These steps install the Safari Home Screen web app. Use the [standalone iPhone build](#build-the-iphone-app) for on-device daily reminders.

Open the HTTPS address of a running Fit30 build in Safari. On your Mac’s Wi-Fi, you can use a [trusted HTTPS preview](#install-over-trusted-https). To share the app with someone on another network, give them a publicly hosted HTTPS address for the production build. The GitHub repository contains the source code.

1. In Safari, tap **Share → Add to Home Screen**. If Safari shows a page menu, open it and tap **Share** first. If the Home Screen action is missing, find it under **Edit Actions** in the share menu. [Apple’s Home Screen guide](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/27/ios/27)
2. Enable **Open as Web App** if shown, then tap **Add**.
3. Open Fit30 from its Home Screen icon while connected. Choose **Get started** to set up your program, or choose **Restore backup** on the welcome screen to bring over an existing program.
4. Open **Settings → Install Fit30** inside the Home Screen app. Wait for **Ready for offline workouts**. If the download is interrupted, reconnect to the Fit30 address and tap **Retry offline setup**.
5. Turn on airplane mode and make sure Wi-Fi is off. Close and reopen Fit30 from its icon. Confirm that Today loads, the workout timer opens, and a tutorial shows its movement guide and written cues. Streaming the embedded YouTube video requires internet.

The Home Screen app uses its own workout storage. If you already logged workouts in Safari, choose **Settings → Backup and export → Download JSON backup** there, then open **Restore backup** in the Home Screen app and select the JSON file. [WebKit’s Home Screen storage details](https://webkit.org/blog/14787/webkit-features-in-safari-17-2/)

To check timer sound, open **Settings → Reminders and alerts → In-workout timer**, enable **Play a sound**, and tap **Test alert**. Tap **Save settings** to use the setting during workouts. Timer alerts are for open workouts. Safari on iPhone lacks the vibration support used by Fit30. [Vibration compatibility](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate#browser_compatibility)

### Install on Android for the gym

1. On your Mac, stop any preview on port 4173 with **Control+C** in its Terminal tab. Then run the following from the project folder.

   ```sh
   npm run phone
   ```

2. On Android, find **Build number** in **Settings → About phone** and tap it seven times. Enable **USB debugging** under **Developer options**. Connect a USB data cable and approve the connection on the phone. [Android setup instructions](https://developer.android.com/studio/debug/dev-options)
3. On your Mac, open `chrome://inspect/#devices` in Chrome and make sure **Discover USB devices** is checked. In **Port forwarding**, enter `4173` on the left and `127.0.0.1:4173` on the right. Check **Enable port forwarding**, then click **Done**. [Chrome USB forwarding instructions](https://developer.chrome.com/docs/devtools/remote-debugging/local-server)
4. On the phone, open `http://localhost:4173/` in Chrome. Finish Fit30 setup or restore your laptop backup. In Fit30, open **Settings → Install Fit30** and wait for **Ready for offline workouts**. Tap **Install on this device** when offered, or use Chrome’s **Install and create shortcut** menu. [Chrome installation instructions](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en)
5. Open Fit30 from the Home Screen, unplug the phone, and turn on airplane mode. Close and reopen the app and verify that the plan, workout timer, and written cues load. Once this check passes, you can use Fit30 at the gym without your Mac. Restore internet access when you want to stream exercise videos.

### Install on Android over Wi-Fi

1. Connect the Mac and your Android 11 or later phone to the same Wi-Fi. On the Mac, run `npm run phone` from the project folder. On Android, open **Developer options → Wireless debugging** and pair with Google’s SDK Platform-Tools. [Wireless pairing instructions](https://developer.android.com/tools/adb#connect-to-a-device-over-wi-fi)
2. In Terminal, run `./adb devices` from the extracted `platform-tools` folder. If the phone is missing from the list, run `./adb connect IP_ADDRESS:PORT` using the **IP address & port** on the main Wireless debugging screen. Then run `./adb reverse tcp:4173 tcp:4173`. [ADB command reference](https://android.googlesource.com/platform/packages/modules/adb/+/refs/heads/main/docs/user/adb.1.md)
3. Open `http://localhost:4173/` in Chrome on the phone. Go to **Settings → Install Fit30**. If the link drops during setup, reconnect, restore the port forwarding, and tap **Retry offline setup**. Fit30 reuses app files it has already downloaded for the current build.
4. When Fit30 says **Ready for offline workouts**, install it from Chrome. Turn off Wireless debugging and test a fresh launch from the Home Screen in airplane mode. [Chrome installation instructions](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en)

### Install over trusted HTTPS

For testing on the same Wi-Fi, use a production preview on your Mac. Set up Node.js and the app dependencies first. [Local setup](#run-on-your-computer)

1. Connect the Mac and phone to the same Wi-Fi. Find the Mac’s IPv4 address in **System Settings → Wi-Fi → Details → TCP/IP**. Install mkcert on the Mac and run the following in the project folder. Replace `192.168.1.25` with your Mac’s address. [mkcert installation guide](https://github.com/FiloSottile/mkcert#installation)

   ```sh
   mkcert -install
   mkdir -p .fit30-certs
   mkcert -key-file .fit30-certs/key.pem -cert-file .fit30-certs/cert.pem 192.168.1.25
   ```

2. Run `mkcert -CAROOT` to find the CA directory. Transfer only `rootCA.pem` to the phone. On iPhone, AirDrop and open the file, then install it under **Settings → Profile Downloaded → Install**. In **Settings → General → About → Certificate Trust Settings**, turn on full trust for the certificate. On Android, install it as a **CA certificate** in the phone’s certificate settings. [mkcert mobile setup](https://github.com/FiloSottile/mkcert#mobile-devices) · [Apple profile installation](https://support.apple.com/en-az/102400) · [Apple certificate trust](https://support.apple.com/en-ie/102390)
3. Build Fit30 and start the HTTPS preview on the Mac. If port 4174 is already in use by a Fit30 preview, stop that preview with **Control+C** in its Terminal tab first.

   ```sh
   npm run build
   FIT30_HTTPS_KEY=.fit30-certs/key.pem FIT30_HTTPS_CERT=.fit30-certs/cert.pem \
     npm run preview -- --host 0.0.0.0 --port 4174
   ```

4. On the phone, open the `https://` **Network** URL printed in Terminal. Use Safari and the [iPhone install steps](#install-on-iphone), or use Chrome on Android and choose **Install and create shortcut** or **Add to Home screen** from its menu. After installing on Android, open Fit30 while connected, wait for **Ready for offline workouts** in **Settings → Install Fit30**, then try reopening it in airplane mode. [Chrome web app guide](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en)

Browser storage belongs to a specific browser and address, including the protocol and port. To move your records to an HTTPS address or another device, use **Settings → Backup and export → Download JSON backup**, then **Restore backup** at the destination.

To update, launch Fit30 from the Home Screen while it can reach its original address. For a Mac HTTPS preview, reconnect to the Mac’s Wi-Fi first. Open **Settings → Install Fit30 → Check for update** and tap **Apply update**. On older Android builds, open `index.html?fit30-update=1` at the same Fit30 address in Chrome. The update keeps your saved workouts and settings.

## Workout walkthrough

Today offers **Resume workout** for a saved session and **Continue plan** for the earliest unfinished workout that has come due. Reopening the app mid-workout takes you back to the current exercise with its timer paused at the latest saved checkpoint. After completing a session, Today shows that workout for the rest of the local day. Calendar records the original dates and the actual workout history. Scheduled rest days still offer recovery and an optional walk.

To match your gym’s weekly closure, open **Settings → Program schedule → Gym closed on**, choose a weekday, and tap **Save recovery day**. Fit30 updates the remaining calendar from the first date that can move. Past dates and workouts with saved attempts keep their dates. The original program still has 26 gym workouts and four planned recovery days. If the last two workouts cross a closure, Fit30 schedules them on the next open days. Today and Calendar show a distinct photo for each scheduled day, and the photos are included in the offline download.

To try Day 3 immediately in a fresh browser profile, set Day 1 to two days ago and choose **Start today’s workout** on Today. Mark the first two exercises done, open the low-row tutorial, then skip the row with a reason. Finish the remaining exercises and tap **Finish workout**. Refresh and check the skipped row in **Today** and **Calendar**, then check **Progress**. Set Day 1 to six days ago in a fresh profile to test the Day 7 rest screen.

The 30-minute target is the sum of the original exercise budgets. A 30-second rest countdown follows completed exercises when another exercise is next. Use **Start next now** whenever you’re ready. Rest and tutorial time are separate from the active exercise budget.

Open a tutorial to pause the workout timer and see its original movement guide and written cues offline. Tap **Play video** to stream the YouTube tutorial in Fit30. If the embedded player stalls or reports a playback error, use the local guide or open the video in YouTube when you have internet.

In **Settings → Reminders and alerts → In-workout timer**, enable sound or vibration and use **Test alert** to check them on your phone. When the workout is visible, Fit30 requests that the screen stay awake during active exercise and rest timers where the device supports it. A visual cue appears at the end of a countdown.

## Track progress by exercise

Open **Progress** to see gym days completed, your streak, and total activity by exercise type. Use **Exercise analytics** to select a movement and see its completed sessions and recent entries. Log cardio details or mark sets done during a workout to capture distance, speed, reps, weight, or hold time. The activity totals and exercise stats share the **Program so far** and **Last 7 days** filters. They use completed exercises from finished workouts in the active program.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The browser suite runs in Chromium against the production build on a temporary preview server. To use an existing Chromium or Chrome executable, set `FIT30_CHROME_PATH` to its full path before running the suite. Use the iPhone airplane-mode check above to verify offline behavior on a physical device.

The original [`data/30_day_gym_plan_with_video_tutorials.json`](data/30_day_gym_plan_with_video_tutorials.json) is validated at runtime and in tests. The program definition is bundled read-only. IndexedDB stores progress separately, and the production service worker caches the app files. A newer offline build takes over after the last tab or installed window using the earlier build is closed.

<details>
<summary>Visual assets</summary>

The built-in image generation tool edited the original studio photos to include a woman and a man in each scene.

The original Today photo is saved in [`public/studio-hero-duo.jpg`](public/studio-hero-duo.jpg). This prompt guided the edit.

> Use case: compositing. Edit this 3:2 Fit30 workout banner photo by adding one adult male athlete, around 30, in a matte charcoal training tank and dark gym shorts. Place him on the woman's left, slightly behind her, pausing between sets. Preserve the woman's face, sportswear, confident pose and the existing elegant plum studio lighting. Give both athletes warm edge light and distinct, clearly visible faces. Slightly widen the framing as needed so both heads fit between 63% and 92% of the width and below the top 8% of the image, with shoulders naturally staggered. Keep the left 52% a quiet dark plum wall for the workout text overlaid by the app. The group should sit on the right so both faces survive a tall right-hand crop on the phone. Keep the same realistic fitness editorial photography, no added text, logos or watermarks.

The welcome photo is saved in [`public/studio-welcome-duo.jpg`](public/studio-welcome-duo.jpg). This prompt guided the edit.

> Use case: compositing. Edit this 3:2 Fit30 welcome photograph by adding one adult male athlete, around 30, seated on the left side of the training bench in a fitted slate training tank and shorts, holding a neatly folded gym towel on his lap as he gets ready. Keep the adult woman at right adjusting her training shoe, with her face, pose, sportswear, and relaxed expression recognizable. Frame both athletes in the center of the same scene, their head centers approximately 42% and 66% across the frame and within the upper middle third, so both are clear in a narrow center crop or wide phone crop. Preserve the soft champagne window light, plum upholstery and studio shadows. Natural fitness editorial photograph with both people in focus, realistic proportions and an independent relaxed posture for each athlete. No added text, logos or watermarks.

</details>

<details>
<summary>Daily photo generation prompts</summary>

The built-in image generation tool used the existing Today and welcome photos as identity references. The 30 optimized results are in [`public/workout-photos`](public/workout-photos).

**Shared prompt**

> Use case: identity-preserve. Create one original, photorealistic 3:2 landscape banner photograph for the Fit30 daily workout screen. The reference photos specify the two recurring adult athletes. Reproduce the same recognizable woman (dark brown training ponytail, oval angular face, expressive brow, warm complexion, toned athletic build) and same recognizable man (dark wavy hair, light beard, athletic build) as closely as possible. Exactly these two people, both sharply and clearly visible with independent purposeful roles; no additional people. Premium plum, charcoal and warm champagne gym aesthetic, high-end documentary sports photography, honest sweat and natural skin texture. She looks confident, attractive and edgy in fitted functional performance sportswear, expressed through real exercise effort and focus. He looks equally capable, focused and athletic. Faces and exercise motion must survive a moderate center crop: centered paired composition with headroom, faces at about 37% and 66% width, equipment and contact points legible. Use one specific candid instant, gaze directed at workout. Keep equipment, limbs, grips and alignment realistic. No text, logos, watermarks or collage.

Each generated photo used the shared prompt followed by the corresponding scene below.

1. Woman leads a controlled seated chest-press rep from a mid-distance three-quarter angle. Burgundy sports bra and charcoal shorts. Man is working an adjacent seated press, both with supported backs and horizontal grips. Bronze backlight, deep plum training floor.
2. Woman leads a focused upright stationary cycling effort on a modern indoor bike. Man rides vigorously on a clearly separate bike alongside, in equally sharp view. Both bodies supported with hands gently on their handlebars. Slate blue sports bra and graphite bottoms, cherry-plum window light, three-quarter profile and plausible pedal and foot positions.
3. Woman leads a chest-supported low-row machine rep. The near machine has an angled chest pad and low neutral handles drawn toward the lower ribs. Man is engaged in another supported row next to her. Molten copper edge light, muted aubergine sleeveless training top, crisp motion detail at the elbows.
4. Woman leads a chest press interval, photographed between repetitions with the loaded machine handles returned under control and elbows comfortably bent. Man actively pedals a stationary bike just adjacent at the same focal distance. Draped neutral sunlight, graphite performance outfit with a wine accent, cinematic wide framing.
5. Man leads a controlled seated horizontal leg press, shown from three-quarter side, his back fully supported and feet flat on the angled plate. Woman is pressing on a separate station at his side, face clear and exertion visible. Her fitted deep olive sports crop and dark leggings look sharp under warm panel lighting.
6. Woman leads a lat pulldown with a long straight cable bar sitting just below chin height, upright torso and thighs supported. Man at his own nearby pulldown is also in the middle of a rep. Brushed steel, lilac rim light, her black shorts and dark burgundy training crop, quiet determined expressions.
7. Recovery day. The two athletes on a genuinely easy walk together outside a modern gym with an aubergine exterior at golden sunrise. Woman leads slightly, wearing a burgundy training zip vest and charcoal shorts, both arms naturally swinging; man strides alongside in a charcoal crew-neck and joggers. Candid relaxed expressions, angled profile, soft daylight.
8. Man leads the next chest-press session, completing a controlled seated machine press at near foreground right. Woman actively presses on the adjacent station on the left, sharply visible and in plum performance gear. Low eye-level side angle with dark studio wall, strip light and naturally aligned wrists.
9. Woman leads a steady treadmill walk at a modest incline with natural arms and relaxed upright stride. Man trains seriously on the treadmill beside her, walking at his own pace. Bright narrow sunrise window catches their faces; her dark graphite matching technical set and warm grey socks; three-quarter lateral tracking shot showing some of each belt.
10. Man leads a low-row set on a real chest-supported machine; he's drawing short neutral handles toward his lower ribs. Woman works in parallel on a neighboring station, equally sharp even though he's nearer. Her plum sportswear, amber mirror-edge lighting, matte gym floor and purposeful breath.
11. Woman leads a real dead-bug core drill on a dark mat, seen from a carefully composed elevated oblique angle. One knee bent over hip, the opposite arm reaching overhead, low back steady. Man working the same drill on his own adjacent mat; keep both faces and hands distinct. Warm plum studio, plum racerback crop and black shorts.
12. Woman leads a supported horizontal leg-press repetition, shoes secured flat against the plate, knees softly flexed, back supported. Man trains actively on a nearby machine at equal visibility, no passive posing. Use a side front angle, luxurious violet shadows and warm window highlights, her smoke-lilac technical sports top.
13. Man leads cable lat pulldowns, viewed from three-quarter front as he pulls the bar to upper chest, feet flat. Woman uses her own pulldown alongside, equally clearly framed and visibly training hard. Both faces sweat-lit against deep aubergine, she wears an ivory training top and plum shorts.
14. Recovery day. Woman sets the pace on an easy after-rain walk beside the man on a dry path at the edge of a quiet landscaped gym terrace. Athletic berry zip-up and graphite shorts, his technical charcoal top; two heads in pleasing warm diffuse light, candid stride, muted steel and plum palette.
15. Woman leads a forearm plank on a gym mat with elbows under shoulders, profile with straight body line and face visible. Man is doing his own forearm plank alongside, head and upper-body sharp. Copper grid light strikes the floor, ribbed black support top with plum binding, purposeful slow breath. Show real muscular effort in both.
16. Man leads a matched pair of indoor stationary bikes, riding seated with a firm steady effort. Woman beside him is an equal active athlete with burgundy training crop and dark bike shorts. Cool concrete cycling studio at morning blue hour, low warm bounce light; framing shows the cranks and hands as well as their expressions.
17. Woman leads a strong low-row pull from a chest-supported seat, amber lights tracing the cable stack, freestanding machine with correct low handles. Man performs his own paced pull on a neighboring machine, equally sharp. Berry athletic top and espresso shorts; higher oblique view to distinguish this session from earlier photos.
18. Woman leads a focused treadmill warm-up walk, clean foot landing and natural motion; man briskly walks beside her on an adjacent belt at equal visibility. Dark garnet sport top with a sleek shoulder strap and charcoal shorts, warm gold bar lights, eye-level three-quarter full dynamic angle.
19. Man leads controlled glute bridges, framed side-on on his own mat with both feet planted and upper back on the floor. Woman performs the same grounded drill on a separate mat, athletic shape and focused face clear, neutral spine. Soft rose light, plum shorts and slate sports crop, realistic knee and foot positions.
20. Woman leads a neutral-grip lat pulldown in a studio corner, upright torso under vertical cable, man training with equal concentration on his own machine. Garnet performance outfit, fan-soft morning light and functional black steel, wide eye-level perspective.
21. Recovery day. Woman and man take a casual riverside walk on a cloud-soft afternoon as the woman naturally steps ahead, zipped plum warm-up layer and dark shorts. Both in genuine motion with relaxed shoulders, visible athletic presence. Neutral stone path, deep greenery and warm accents, calm documentary composition.
22. Woman leads a supported chest press with a controlled grip, captured from front corner just as she begins the push. Man is pushing on his own machine and fills the neighboring side of the frame with equal strength. Plum-black studio, bronze grid lighting, espresso and garnet training clothes, slightly wider lens.
23. Man leads a supported seated leg-press session, controlling the return rather than locking the knees. Woman is actively doing her supported leg press a station over, clearly powerful and independently focused. Sleek moss technical top with black bike shorts; crisp shadows, pale champagne side light, both faces visible.
24. Woman leads an upright chest-supported low row against dark brushed alloy, holding the handles level near the lower ribs. Man trains at the adjacent machine, equal facial and physical definition. Fitted charcoal top with plum panels, saturated merlot edge light and three-quarter camera at chest height.
25. Woman leads a controlled mid-workout stationary bike cadence. Man alongside is pushing his own pace with equal strength and attention. Swept-back ponytail, she wears a light mushroom sports bra and wine shorts under moody skylight. Wider oblique view, clear hands, pedals, and faces; studio floor and window reflections.
26. Man leads a low, steady stationary bike effort, elbows relaxed and feet secure. Woman rides upright on a separate bike just alongside, equally visible and engaged in a strong rhythm. Burgundy athletic apparel with minimalist graphite details, rose-gold rim light, angled full torso composition.
27. Woman leads her final cable lat pulldown, controlled bar at upper chest, legs stabilized by the pad. Man actively completes his own adjacent pulldown with equal confidence. Her garnet halter-style performance top and black shorts, weathered charcoal gym hardware, faint plum reflected light and crisp action.
28. Recovery day. The woman leads a natural brisk easy walk on a shaded urban path by the studio at dusk, with the man comfortably in step beside her. Deep-wine athletic jacket, black shorts, and neutral crewneck gym wear. Amber street-edge glow, two equally visible faces, authentic unposed movement.
29. Man leads the penultimate chest-press session, making a purposeful controlled press on a seated machine. Woman is doing a strong press on the adjacent machine at equal exposure and focus. Rich bronze sports crop with charcoal shorts, deep warm window light, change to a reverse three-quarter camera angle.
30. Woman leads the final day with a composed seated leg press near twilight, settled supported torso and firm shoes on the plate. Man is performing his own leg press on the next station, equally powerful with a clearly lit face. Edgy midnight plum sports gear and graphite gym wear, elegant gold light through a high window, celebratory through evident effort.

</details>
