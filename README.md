# 🏋️ Mobile Workout Dashboard

A **mobile-first workout web application** for structured training routines with **automatic timers, rest periods, vibration feedback**, and a modern **dark dashboard UI**.

The app is designed for **phone usage** and works completely **offline after first load**.

---

## ✨ Features

- 📱 **Mobile-first design** (optimized for smartphones)
- 🧩 **Workout routines loaded from JSON**
- ⏱️ **Time-based exercises**
  - Countdown timers
  - Automatic rest periods
  - Auto-continue to next set
- 🔁 **Reps-based exercises**
  - Set counter (plus / minus)
  - Optional automatic rest timer
- 🔔 **Device vibration**
  - Set start / end
  - Exercise completion
  - Routine completion
- 🔄 **Animated progress indicators**
- 🖼️ **Exercise images with tap-to-zoom**
- 🔍 **Fullscreen timer mode**
- 💾 **LocalStorage persistence**
  - Exercise progress
  - Active timers
  - Completed routines (history)
- 🌙 **Dark dashboard UI**
  - Rounded cards
  - Soft shadows
  - Minimal accent colors

---

## 🗂️ Project Structure
```
training-dashboard/
│
├── index.html # Main HTML file
├── style.css # Dark dashboard UI styles
├── app.js # Application logic (timers, state, vibration)
├── routines.json # Workout routines & exercises
└── images/ # Exercise images (optional)
```


---

## 🧠 Exercise Types

### ⏱️ Time-Based Exercises
Defined by:
- `durationSec`
- `sets`
- `restSec`

Behavior:
- Countdown timer per set
- Automatic rest countdown
- Automatic next set
- Visual timer state (active / rest)
- Vibration feedback

---

### 🔁 Repetition-Based Exercises
Defined by:
- `sets`
- `reps`
- `restSec`

Behavior:
- Manual set completion
- Large set counter
- Optional automatic rest timer
- Vibration on set completion

---

## 🖼️ Exercise Images

- Each exercise can include an optional image
- Images are shown as thumbnails in exercise cards
- Tap image to open fullscreen zoom view
- If no image is provided, a placeholder is shown

Example in `routines.json`:

```json
{
  "name": "Plank",
  "image": "images/plank.jpg",
  "type": "time",
  "sets": 3,
  "durationSec": 45,
  "restSec": 30
}
```
# 🚀 Getting Started
## Option 1: Local Server (recommended)

Some browsers block JSON loading via file://.

```python -m http.server```


Then open:

```http://localhost:8000```

## Option 2: Direct File Open

May work in some browsers, but JSON loading can fail.

---

# 📳 Vibration Support

- Uses the Vibration API

- Works on most Android devices and modern browsers

- Requires user interaction (button press)

- Gracefully ignored if unsupported

---

# 💾 Offline Usage

- All data stored locally in the browser

- No external dependencies

- Works offline after first load

---

# 🎨 Design Philosophy

- Inspired by modern smart dashboards

- Dark, minimal UI

- High contrast timers

- Touch-friendly controls

- No clutter

---

# 🔒 Privacy

No accounts

No tracking

No external services

All data stays on your device

- 📌 Future Enhancements (Ideas)

- 🔊 Optional sound cues

- 📲 PWA install support

- 🧠 Smart auto-advance between exercises

- 📊 Training statistics & charts

---

# 📄 License

MIT License – free to use, modify, and distribute.
