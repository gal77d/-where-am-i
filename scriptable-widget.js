// ווידג'ט "איפה אני" לאפליקציית Scriptable (iOS)
// מציג על מסך הבית את הטמפרטורה ושם המקום לפי המיקום הנוכחי.
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

async function getTemp(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m`;
  const d = await new Request(url).loadJSON();
  return Math.round(d.current.temperature_2m);
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

async function buildWidget() {
  const w = new ListWidget();
  w.url = SITE;
  w.backgroundColor = new Color('#0f172a');
  w.setPadding(14, 14, 14, 14);
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000); // רענון כל ~15 דקות

  const label = w.addText('איפה אני');
  label.font = Font.mediumSystemFont(12);
  label.textColor = new Color('#94a3b8');

  w.addSpacer();

  const loc = await getLocation();
  let temp = '--°', place = 'אין מיקום';
  if (loc) {
    try { temp = (await getTemp(loc.latitude, loc.longitude)) + '°'; } catch (e) {}
    place = (await getPlace(loc.latitude, loc.longitude)) || '';
  }

  const t = w.addText(temp);
  t.font = Font.boldSystemFont(44);
  t.textColor = new Color('#f1f5f9');
  t.minimumScaleFactor = 0.6;

  const pl = w.addText(place);
  pl.font = Font.semiboldSystemFont(14);
  pl.textColor = new Color('#38bdf8');
  pl.lineLimit = 1;
  pl.minimumScaleFactor = 0.7;

  return w;
}

const widget = await buildWidget();
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentSmall();
}
Script.complete();
