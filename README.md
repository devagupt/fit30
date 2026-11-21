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

## Try it on your phone

Connect the computer and phone to the same Wi-Fi. Stop any running preview with **Control+C**, then run the following from the project folder.

```sh
npm run build
npm run preview -- --host 0.0.0.0
```

On your phone, open the **Network** URL printed in the terminal. Use Safari on iPhone or Chrome on Android. This works while the Mac and phone can reach each other. For offline use, set up Fit30 once using Android USB forwarding or trusted HTTPS. [Service Workers specification](https://www.w3.org/TR/service-workers/)

### Install on Android for the gym

1. On your Mac, stop any preview on port 4173 with **Control+C** in its Terminal tab. Then run the following from the project folder.

   ```sh
   npm run phone
   ```

2. On Android, find **Build number** in **Settings → About phone** and tap it seven times. Enable **USB debugging** under **Developer options**. Connect a USB data cable and approve the connection on the phone. [Android setup instructions](https://developer.android.com/studio/debug/dev-options)
3. On your Mac, open `chrome://inspect/#devices` in Chrome and make sure **Discover USB devices** is checked. In **Port forwarding**, enter `4173` on the left and `127.0.0.1:4173` on the right. Check **Enable port forwarding**, then click **Done**. [Chrome USB forwarding instructions](https://developer.chrome.com/docs/devtools/remote-debugging/local-server)
4. On the phone, open `http://localhost:4173/` in Chrome. Finish Fit30 setup or restore your laptop backup. In Fit30, open **Settings → Install Fit30** and wait for **Ready for offline workouts**. Tap **Install on this device** when offered, or use Chrome’s **Install and create shortcut** menu. [Chrome installation instructions](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en)
5. Open Fit30 from the Home Screen, unplug the phone, and turn on airplane mode. Close and reopen the app and verify that the plan, workout timer, and written cues load. Once this check passes, you can use Fit30 at the gym without your Mac. Restore internet access when you want to stream exercise videos.

### Install over trusted HTTPS

1. With [mkcert](https://github.com/FiloSottile/mkcert) installed on your computer, run `mkcert -install`. Copy the computer’s IPv4 address from the **Network** URL and use it in place of `192.168.1.25` below.

   ```sh
   mkdir -p .fit30-certs
   mkcert -key-file .fit30-certs/key.pem -cert-file .fit30-certs/cert.pem 192.168.1.25
   ```

2. Transfer only the `rootCA.pem` certificate from the folder printed by `mkcert -CAROOT` to your phone. Install and trust it using the phone’s certificate settings. On iPhone, install the profile in Settings, then enable full trust under **General → About → Certificate Trust Settings**. [mkcert mobile setup](https://github.com/FiloSottile/mkcert#mobile-devices) · [Apple certificate instructions](https://support.apple.com/en-us/102390)
3. Stop the HTTP preview with **Control+C**, then run the HTTPS preview. Open its `https://` Network URL on the phone.

   ```sh
   FIT30_HTTPS_KEY=.fit30-certs/key.pem FIT30_HTTPS_CERT=.fit30-certs/cert.pem npm run preview -- --host 0.0.0.0
   ```

4. Tap **Share → Add to Home Screen** in Safari and enable **Open as Web App** if shown. In Chrome on Android, open **Menu**, choose **Install and create shortcut** or **Add to Home screen**, then tap **Install**. [Apple Home Screen guide](https://support.apple.com/en-az/guide/iphone/iphea86e5236/26/ios/26) · [Chrome web app guide](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en)
5. Open the installed app while online and confirm **Settings → Install Fit30** reports that offline setup is ready. Turn on airplane mode, reopen Fit30, and confirm you can still view the plan, read form cues, and save progress.

Browser storage belongs to a specific browser and address, including the protocol and port. To move your records to an HTTPS address or another device, use **Settings → Download JSON backup**, then **Restore backup** at the destination. A calendar file contains upcoming reminders at your selected time. Import it into your calendar and replace that import when the schedule changes. Alert delivery follows your calendar’s settings.

## Workout walkthrough

Today offers **Resume workout** for a saved session and **Continue plan** for the earliest unfinished workout that has come due. After completing a session, Today shows that workout for the rest of the local day. Calendar records the original dates and the actual workout history. Scheduled rest days still offer recovery and an optional walk.

To try Day 3 immediately in a fresh browser profile, set Day 1 to two days ago and choose **Start today’s workout** on Today. Mark the first two exercises done, open the low-row tutorial, then skip the row with a reason. Finish the remaining exercises and tap **Finish workout**. Refresh and check the skipped row in **Today** and **Calendar**, then check **Progress**. Set Day 1 to six days ago in a fresh profile to test the Day 7 rest screen.

The 30-minute target is the sum of the original exercise budgets. You can pause or go into overtime. Opening a tutorial pauses the timer until you resume it. A timer left running when the app is closed for an extended period resumes paused at its last saved checkpoint. Tap **Play video** in a tutorial to watch it in Fit30. Videos stream from YouTube and need internet access. Written cues are available offline, and the YouTube link is a fallback if a clip cannot play in the app. Fit30 provides calendar exports for closed-app reminders and visual timer cues during workouts. Device-verified push and advanced charts and history editing are later phases.

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

The browser suite uses the production build and a temporary preview server. To use an existing Chromium or Chrome executable, set `FIT30_CHROME_PATH` to its full path before running the suite.

The original [`data/30_day_gym_plan_with_video_tutorials.json`](data/30_day_gym_plan_with_video_tutorials.json) is validated at runtime and in tests. The program definition is bundled read-only. IndexedDB stores progress separately, and the production service worker caches the app files. A newer offline build takes over after the last tab or installed window using the earlier build is closed.

<details>
<summary>Visual assets</summary>

The built-in image generation tool edited the original studio photos to include a woman and a man in each scene.

The Today photo is saved in [`public/studio-hero-duo.jpg`](public/studio-hero-duo.jpg). This prompt guided the edit.

> Use case: compositing. Edit this 3:2 Fit30 workout banner photo by adding one adult male athlete, around 30, in a matte charcoal training tank and dark gym shorts. Place him on the woman's left, slightly behind her, pausing between sets. Preserve the woman's face, sportswear, confident pose and the existing elegant plum studio lighting. Give both athletes warm edge light and distinct, clearly visible faces. Slightly widen the framing as needed so both heads fit between 63% and 92% of the width and below the top 8% of the image, with shoulders naturally staggered. Keep the left 52% a quiet dark plum wall for the workout text overlaid by the app. The group should sit on the right so both faces survive a tall right-hand crop on the phone. Keep the same realistic fitness editorial photography, no added text, logos or watermarks.

The welcome photo is saved in [`public/studio-welcome-duo.jpg`](public/studio-welcome-duo.jpg). This prompt guided the edit.

> Use case: compositing. Edit this 3:2 Fit30 welcome photograph by adding one adult male athlete, around 30, seated on the left side of the training bench in a fitted slate training tank and shorts, holding a neatly folded gym towel on his lap as he gets ready. Keep the adult woman at right adjusting her training shoe, with her face, pose, sportswear, and relaxed expression recognizable. Frame both athletes in the center of the same scene, their head centers approximately 42% and 66% across the frame and within the upper middle third, so both are clear in a narrow center crop or wide phone crop. Preserve the soft champagne window light, plum upholstery and studio shadows. Natural fitness editorial photograph with both people in focus, realistic proportions and an independent relaxed posture for each athlete. No added text, logos or watermarks.

</details>
