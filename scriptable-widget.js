// ווידג'ט "איפה אני" לאפליקציית Scriptable (iOS)
// מציג על מסך הבית את הטמפרטורה, מזג האוויר ושם המקום לפי המיקום הנוכחי.
// לחיצה על הווידג'ט פותחת את האתר.

const SITE = 'https://gal77d.github.io/-where-am-i/';
const CACHE_KEY = 'where-am-i-last-location';

async function getLocation() {
  try {
    Location.setAccuracyToThreeKilometers();
    const loc = await Location.current();
    Keychain.set(CACHE_KEY, JSON.stringify(loc));
    return loc;
  } catch (e) {
    // אם אין גישה למיקום כרגע, משתמשים במיקום האחרון שנשמר
    if (Keychain.contains(CACHE_KEY)) return JSON.parse(Keychain.get(CACHE_KEY));
    return null;
  }
}

async function getWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    '&current=temperature_2m,apparent_temperature,weather_code,is_day,precipitation' +
    '&minutely_15=precipitation&forecast_minutely_15=32' +
    '&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto&forecast_days=2';
  const d = await new Request(url).loadJSON();
  // כל הזמנים מגיעים בשעון המקומי של המיקום, אז משווים אותם זה לזה
  const now = new Date(d.current.time);
  return {
    rain: rainText(now, d.current.precipitation, d.minutely_15),
    sun: sunText(now, d.current.is_day === 1, d.daily),
    temp: Math.round(d.current.temperature_2m),
    feels: Math.round(d.current.apparent_temperature),
    code: d.current.weather_code,
    isDay: d.current.is_day === 1,
    max: Math.round(d.daily.temperature_2m_max[0]),
    min: Math.round(d.daily.temperature_2m_min[0])
  };
}

function fmtDuration(ms) {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return `${min} דק׳`;
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')} שע׳`;
}

// גשם ב-8 השעות הקרובות, ברזולוציה של רבע שעה
function rainText(now, currentPrecip, m) {
  if (currentPrecip >= 0.1) return '☔ יורד גשם עכשיו';
  for (let i = 0; i < m.time.length; i++) {
    const t = new Date(m.time[i]);
    if (t < now) continue;
    if (m.precipitation[i] >= 0.1) {
      const ms = t - now;
      return ms < 15 * 60000 ? '☔ גשם בקרוב' : `☔ גשם בעוד ${fmtDuration(ms)}`;
    }
  }
  return '🌂 יבש ב-8 שעות הקרובות';
}

function sunText(now, isDay, daily) {
  const sunset = new Date(daily.sunset[0]);
  if (isDay && sunset > now) return `🌅 שקיעה בעוד ${fmtDuration(sunset - now)}`;
  const sunrise = new Date(now < new Date(daily.sunrise[0]) ? daily.sunrise[0] : daily.sunrise[1]);
  return `🌄 זריחה בעוד ${fmtDuration(sunrise - now)}`;
}

async function getPlace(lat, lon) {
  try {
    const res = await Location.reverseGeocode(lat, lon, 'he');
    const p = res[0] || {};
    return p.locality || p.subAdministrativeArea || p.country || '';
  } catch (e) {
    return '';
  }
}

// קוד מזג אוויר (WMO) → סמל SF Symbols וצבע
function weatherIcon(code, isDay) {
  if (code === 0) return isDay ? ['sun.max.fill', '#fde047'] : ['moon.stars.fill', '#e2e8f0'];
  if (code <= 2) return isDay ? ['cloud.sun.fill', '#fde047'] : ['cloud.moon.fill', '#e2e8f0'];
  if (code === 3) return ['cloud.fill', '#e2e8f0'];
  if (code <= 48) return ['cloud.fog.fill', '#cbd5e1'];
  if (code <= 57) return ['cloud.drizzle.fill', '#bae6fd'];
  if (code === 65 || code === 82) return ['cloud.heavyrain.fill', '#7dd3fc'];
  if (code <= 67 || (code >= 80 && code <= 82)) return ['cloud.rain.fill', '#7dd3fc'];
  if (code <= 86) return ['cloud.snow.fill', '#f8fafc'];
  return ['cloud.bolt.rain.fill', '#fbbf24'];
}

// רקע לפי הטמפרטורה, ורקע לילה אחרי השקיעה
function background(temp, isDay) {
  let colors;
  if (!isDay) colors = ['#1e1b4b', '#0f172a'];
  else if (temp < 10) colors = ['#1d4ed8', '#1e3a8a'];
  else if (temp < 20) colors = ['#0891b2', '#155e75'];
  else if (temp < 28) colors = ['#ea580c', '#9a3412'];
  else colors = ['#dc2626', '#7f1d1d'];
  const g = new LinearGradient();
  g.colors = colors.map(c => new Color(c));
  g.locations = [0, 1];
  return g;
}

function addText(stack, text, font, color, opacity = 1) {
  const t = stack.addText(text);
  t.font = font;
  t.textColor = new Color(color, opacity);
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.6;
  return t;
}

async function buildWidget() {
  const w = new ListWidget();
  w.url = SITE;
  w.setPadding(10, 12, 10, 12);
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000); // רענון כל ~15 דקות

  const loc = await getLocation();
  let weather = null, place = 'אין מיקום';
  if (loc) {
    try { weather = await getWeather(loc.latitude, loc.longitude); } catch (e) {}
    place = (await getPlace(loc.latitude, loc.longitude)) || '';
  }

  if (!weather) {
    w.backgroundColor = new Color('#0f172a');
    addText(w, place, Font.semiboldSystemFont(14), '#38bdf8');
    w.addSpacer();
    addText(w, '--°', Font.boldSystemFont(40), '#f1f5f9');
    addText(w, 'אין נתוני מזג אוויר', Font.systemFont(12), '#94a3b8');
    return w;
  }

  w.backgroundGradient = background(weather.temp, weather.isDay);

  // שורה עליונה: אייקון מזג אוויר + שם המקום
  const top = w.addStack();
  top.centerAlignContent();
  const [symbol, tint] = weatherIcon(weather.code, weather.isDay);
  const icon = top.addImage(SFSymbol.named(symbol).image);
  icon.imageSize = new Size(26, 26);
  icon.tintColor = new Color(tint);
  top.addSpacer(6);
  addText(top, place, Font.semiboldSystemFont(14), '#ffffff');

  w.addSpacer();

  addText(w, weather.temp + '°', Font.boldSystemFont(34), '#ffffff');
  addText(w, `↑${weather.max}° ↓${weather.min}° · מרגיש ${weather.feels}°`, Font.mediumSystemFont(11), '#ffffff', 0.85);
  addText(w, weather.rain, Font.mediumSystemFont(11), '#ffffff', 0.85);
  addText(w, weather.sun, Font.mediumSystemFont(11), '#ffffff', 0.85);

  w.addSpacer(2);

  const df = new DateFormatter();
  df.dateFormat = 'HH:mm';
  addText(w, `עודכן ${df.string(new Date())}`, Font.systemFont(9), '#ffffff', 0.6);

  return w;
}

const widget = await buildWidget();
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentSmall();
}
Script.complete();
