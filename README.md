# MKI End of Day Report

Home screen launcher for MKI LLC foremen. It opens a fresh copy of the end of day report form every time.

**Live page:** https://mki-llc.github.io/report/

## How it works

1. A foreman taps the **MKI Report** icon on the iPad or phone home screen.
2. The page shows today's date and one button: **Start today's report**.
3. The button opens the Microsoft Form (sign-in with the foreman's MKI account).
4. After submit, Power Automate files the photos and a PDF in the job folder on the MKI Field Reports SharePoint site, adds a row to the Daily Reports list, and emails Alex a short note.

## Add to a home screen (iPhone or iPad)

1. Open the live page in Safari.
2. Tap Share, then **Add to Home Screen**.
3. Keep the name **MKI Report** and tap Add.

## Files

- `index.html` is the start screen
- `manifest.webmanifest` holds the app name and colors
- `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` are the home screen icons
- `logo-white.svg` is the MKI logo

## Changing the form link

Edit `FORM_URL` near the bottom of `index.html`. Use the short link from Microsoft Forms, under Collect responses.

Brand red: `#990000`
