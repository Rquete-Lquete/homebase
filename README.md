# Homebase

A personal iPhone app for a student on the SST-NP Integrated Diploma Programme: a live Today screen (current lesson, weather, buses), tasks, timetable, grades, a focus timer, Apple Health numbers, and an IDP hub for the capstone, NP course shortlist and portfolio. It's a web app: once it's on your Home Screen it opens full screen like any other app, works offline, and keeps all its data on your iPhone.

## 1. Put it online (free, about 5 minutes)

GitHub Pages hosts it for free. Do this on a laptop.

1. Sign in at github.com and create a new repository named `homebase`. Public is fine: only the code is public, and your data never leaves your phone.
2. On the empty repository page, click **uploading an existing file** and drag in everything in this folder: `index.html`, `styles.css`, `sw.js`, `manifest.webmanifest`, `README.md` and the `js` and `icons` folders. Click **Commit changes**.
3. Go to **Settings > Pages**. Under **Build and deployment**, choose **Deploy from a branch**, pick `main` and `/ (root)`, then **Save**.
4. After a minute or two the app is live at `https://YOUR-USERNAME.github.io/homebase/`.

## 2. Install it on your iPhone

1. Open that link in **Safari**.
2. Tap **Share** (on iOS 26 it can be inside the **•••** menu), then **Add to Home Screen**.
3. Keep **Open as Web App** on and tap **Add**.
4. Open Homebase from the new icon. The Home Screen app keeps its own data, separate from Safari, so set everything up inside it.

The **Finish setting up** card on Today links to an in-app guide for the two shortcuts below.

## 3. The two shortcuts

A web app can't read Apple Health or schedule its own alerts, so Homebase hands those jobs to the Shortcuts app. Build each one once. The names must match Settings in Homebase.

### Homebase Reminder (adds reminders to Apple Reminders)

Homebase runs this shortcut with text like:

```
Chemistry worksheet 4
Chemistry, Due Wed 11 Nov
10 Nov 2026 20:00
```

First line is the title, last line is when to alert, anything between is notes.

1. Shortcuts > **+** > rename it **Homebase Reminder**.
2. **Split Text**: set the text to **Shortcut Input**, split by **New Lines**.
3. **Get Item from List**: **First Item** (the title).
4. **Get Item from List**: **Last Item** (the date and time).
5. **Get Dates from Input** (takes the last item).
6. **Add New Reminder** (called **Create Reminder** on some versions): title = the first Item from List, choose a list, and set the alert or due date to **Dates**.
7. In Homebase, Setup guide > **Send a test reminder**.

### Homebase Health (copies today's numbers)

1. Shortcuts > **+** > rename it **Homebase Health**.
2. **Find Health Samples**: Type **Steps**, Start Date **is today**, Group By **Day**.
3. The same for **Walking + Running Distance**, **Active Energy** and **Exercise Minutes**.
4. **Find Health Samples**: **Resting Heart Rate**, sort by Start Date, Latest First, Limit 1.
5. Optional sleep (needs an Apple Watch or sleep app): **Find Health Samples** for **Sleep Analysis**, Start Date in the last 1 day, filters **Value is not In Bed** and **Value is not Awake**; then **Get Details of Health Samples** > Duration; then **Calculate Statistics** > Sum.
6. **Text**, with each value inserted after its `=`:

   ```
   HB1
   steps=
   km=
   kcal=
   ex=
   rhr=
   sleep=
   ```

7. **Copy to Clipboard**.
8. Run it once inside Shortcuts and allow Health access.

To sync: Health > **Sync**. When the shortcut finishes, tap **‹ Homebase** at the top-left, then **Paste**. Recent iOS versions don't reliably send a shortcut's result back to the app that started it, so the clipboard does the carrying.

The parser accepts numbers with units (`4.6 km`, `318 kcal`), sleep in seconds, minutes, hours, `7 hr 12 min` or `7:12`, and a specific day with `steps@2026-11-09=10234`.

## How the data works

- Everything is saved in the app's local storage on your iPhone. Removing Homebase from your Home Screen deletes it, so use **Settings > Export a backup** now and then.
- Bus arrivals come from ArriveLah (`arrivelah2.busrouter.sg`), a free proxy for LTA DataMall's Bus Arrival API. The stop list comes from BusRouter SG (`data.busrouter.sg`). Neither needs a key. If ArriveLah ever goes down, LTA DataMall gives out free keys, but it blocks requests from web pages, so you'd need a small proxy (a Cloudflare Worker works) and to change `ARRIVALS_URL` in `js/bus.js`.

## Updating from version 1

Upload every file in this folder to the same repository, replacing the old ones (delete `js/portfolio.js`, it's no longer used). Your saved data on the phone carries over. Close and reopen Homebase twice to pick up the new version.

## Changing the app

| File | What it does |
| --- | --- |
| `js/main.js` | Screens, tab bar, event handling |
| `js/store.js` | Saved data and backups |
| `js/today.js` | Today screen |
| `js/tasks.js` | Tasks and reminders |
| `js/bus.js` | Bus boards, search, nearby |
| `js/health.js` | Health import, tiles, chart |
| `js/plan.js`, `js/timetable.js`, `js/grades.js` | Plan tab: timetable and grades |
| `js/focus.js` | Focus timer |
| `js/weather.js` | NEA weather (data.gov.sg) |
| `js/idp.js` | Capstone, NP courses, key dates, portfolio |
| `js/settings.js` | Settings and the setup guide |
| `js/shortcuts.js` | Links to the Shortcuts app |
| `styles.css` | All styling, light and dark |
| `sw.js` | Offline support |

To try changes on your laptop, run `python3 -m http.server 8000` in this folder and open `http://localhost:8000`. After uploading changes to GitHub, change `VERSION` in `sw.js` so phones fetch the new files.
