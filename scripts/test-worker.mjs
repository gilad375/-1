import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import worker from "../dist/server/index.js";

const sqlite = new DatabaseSync(":memory:");
sqlite.exec("PRAGMA foreign_keys=ON");
for (const name of ["0000_moaning_toad_men.sql", "0001_closed_speed_demon.sql", "0002_omniscient_stature.sql", "0003_slimy_namorita.sql", "0004_abandoned_lord_hawal.sql", "0005_previous_prima.sql", "0006_wooden_living_lightning.sql", "0007_family_recipe_enhancements.sql", "0008_recipe_video_storage.sql", "0009_family_extras.sql", "0010_cooking_extras.sql", "0011_family_planning_memories.sql", "0012_family_recipe_ratings.sql", "0013_family_kitchen_tools.sql"]) {
  const sql = await readFile(new URL(`../drizzle/${name}`, import.meta.url), "utf8");
  for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) sqlite.exec(statement);
}

class Statement {
  constructor(sql, values = []) { this.sql = sql; this.values = values; }
  bind(...values) { return new Statement(this.sql, values); }
  async all() { return { results: sqlite.prepare(this.sql).all(...this.values) }; }
  async first() { return sqlite.prepare(this.sql).get(...this.values) || null; }
  async run() { return { meta: { changes: Number(sqlite.prepare(this.sql).run(...this.values).changes) } }; }
}
const objects = new Map();
const env = {
  DB: {
    prepare(sql) { return new Statement(sql); },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec("COMMIT"); return results; }
      catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  },
  BUCKET: {
    async put(key, body, options) { objects.set(key, { bytes: new Uint8Array(await new Response(body).arrayBuffer()), type: options?.httpMetadata?.contentType || "application/octet-stream" }); },
    async get(key) {
      const item = objects.get(key); if (!item) return null;
      return { body: item.bytes, httpEtag: '"test"', writeHttpMetadata(headers) { headers.set("content-type", item.type); } };
    },
    async delete(key) { objects.delete(key); },
  },
};
const call = (path, init) => worker.fetch(new Request(`https://cookbook.test${path}`, init), env, {});

const root = await call("/");
assert.equal(root.status, 200);
const rootHtml = await root.text();
assert.match(rootHtml, /כל מה שנשמר מופיע לכולם/);
assert.match(rootHtml, /recipeNameAboveActions/);
assert.match(rootHtml, /\.food\{height:240px/);
assert.match(rootHtml, /heroEditButton/);
assert.match(rootHtml, /🌾🚫 ללא גלוטן/);
assert.match(rootHtml, /🗑️ מחיקת מתכון/);
assert.match(rootHtml, /עד 20 בני משפחה/);
assert.match(rootHtml, /filterCards\('gluten-free'/);
assert.match(rootHtml, /safeCompactDrawer/);
assert.match(rootHtml, /filterCards\('kids'/);
assert.match(rootHtml, /שמירת פרטי המשפחה/);
assert.match(rootHtml, /safeMetaTaste/);
assert.match(rootHtml, /recipeAuthorLine/);
assert.match(rootHtml, /filterRecipesByAuthor/);
assert.match(rootHtml, /משוב ורעיונות לשיפור/);
assert.match(rootHtml, /submitFeedback/);
assert.doesNotMatch(rootHtml, /מצב הדגמה/);
assert.match(rootHtml, /תיבת ההודעות שלי/);
assert.match(rootHtml, /השם שלי לא ברשימה/);
assert.match(rootHtml, /❤️ מועדפים/);
assert.match(rootHtml, /לחצו „ראיתי” או „לענות”/);
assert.match(rootHtml, /תקנון שימוש/);
assert.match(rootHtml, /מדיניות פרטיות/);
assert.match(rootHtml, /הצהרת נגישות/);
assert.match(rootHtml, /איש קשר לפניות בנושא נגישות: גלעד/);
assert.match(rootHtml, /דילוג לתוכן הראשי/);
assert.match(rootHtml, /copyrightNotice/);
assert.match(rootHtml, /דיווח על תוכן פוגע או מפר זכויות/);
assert.match(rootHtml, /בקשת מחיקה או הסרת תוכן/);
assert.match(rootHtml, /Tab ו‑Shift\+Tab/);
assert.match(rootHtml, /--muted:#77645b/);
assert.match(rootHtml, /alt="\$\{escapeHTML\(r\.name\)\} — תמונה \$\{index\+1\}"/);
assert.match(rootHtml, /aria-label="מחיקת תמונה \$\{i\+1\} של/);
assert.match(rootHtml, /שימוש משפחתי ומכבד/);
assert.match(rootHtml, /liveRecipeSearch/);
assert.match(rootHtml, /תוצאות לחיפוש/);
assert.match(rootHtml, /תגובות והערות/);
assert.match(rootHtml, /שיתוף בוואטסאפ/);
assert.match(rootHtml, /להתחיל לבשל/);
assert.match(rootHtml, /מתכונים לחגים ולאירועים/);
assert.match(rootHtml, /5MB ועד 30 שניות/);
assert.match(rootHtml, /מתכון השבוע/);
assert.match(rootHtml, /תפריטים/);
assert.match(rootHtml, /סיפורי משפחה/);
assert.match(rootHtml, /הדפסת הספר/);
assert.match(rootHtml, /כוסות לגרמים בקירוב/);
assert.match(rootHtml, /כלי מטבח/);
assert.match(rootHtml, /מה מבשלים השבת/);
assert.match(rootHtml, /בחרו יום מהיום ועד שלושה שבועות קדימה/);
assert.match(rootHtml, /plannerCalendar/);
assert.match(rootHtml, /ארוחה משפחתית/);
assert.match(rootHtml, /ארוחת שישי \/ שבת/);
assert.match(rootHtml, /פיקניק משפחתי/);
assert.doesNotMatch(rootHtml, /אלבום זיכרונות/);
assert.match(rootHtml, /הפתיעו אותי עם מתכון/);
assert.doesNotMatch(rootHtml, /personRecipeNames/);
assert.doesNotMatch(rootHtml, /personRecipeName/);
assert.doesNotMatch(rootHtml, /המתכונים \(\$\{authored\.length\}\)/);
assert.doesNotMatch(rootHtml, /מאסטר\/ית הקינוחים/);
assert.match(rootHtml, /יצירת כרטיסיית מתכון לשיתוף/);
assert.match(rootHtml, /מה יש במקרר/);
assert.match(rootHtml, /הוספה לרשימה/);
assert.match(rootHtml, /fridgeChipRemove/);
assert.match(rootHtml, /חסרים: /);
assert.match(rootHtml, /fridgeResultStats/);
assert.match(rootHtml, /רשימת הקניות שלי/);
assert.match(rootHtml, /כמה מנות להכין/);
assert.match(rootHtml, /מצב לילה/);
assert.match(rootHtml, /cookModeOverlay/);
assert.match(rootHtml, /cookIngredients/);
assert.match(rootHtml, /cookSteps/);
assert.match(rootHtml, /sessionStorage.setItem\(savedKey/);
assert.match(rootHtml, /wakeLock.request\("screen"\)/);
assert.match(rootHtml, /dedication/);
assert.match(rootHtml, /tryouts/);
assert.match(rootHtml, /הקדשה/);

let response = await call("/api/feedback", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: "גלעד", type: "רעיון לשיפור", message: "להוסיף עוד קטגוריות" }),
});
assert.equal(response.status, 201);
assert.deepEqual({ ...sqlite.prepare("SELECT name,type,message FROM feedback").get() }, { name: "גלעד", type: "רעיון לשיפור", message: "להוסיף עוד קטגוריות" });
response = await call("/api/feedback", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: "עלמה", type: "דיווח תוכן", message: "לדווח על תוכן" }),
});
assert.equal(response.status, 201);

const familyForm = new FormData(); familyForm.set("name", "גלעד טורדג'מן"); familyForm.set("bio", "אופה");
familyForm.set("photo", new File([new Uint8Array([1, 2, 3])], "photo.png", { type: "image/png" }));
const giladCreated = await call("/api/family", { method: "POST", body: familyForm });
assert.equal(giladCreated.status, 201);
const giladId = (await giladCreated.json()).id;
response = await call(`/api/family/${giladId}/name`, {
  method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "גלעד" }),
});
assert.equal(response.status, 200);
assert.equal(sqlite.prepare("SELECT name FROM family_members WHERE id=?").get(giladId).name, "גלעד");

const almaForm = new FormData(); almaForm.set("name", "עלמה"); almaForm.set("bio", "אופה");
assert.equal((await call("/api/family", { method: "POST", body: almaForm })).status, 201);

response = await call("/api/messages", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ sender: "גלעד", recipient: "עלמה", body: "בדיקת הודעה" }),
});
assert.equal(response.status, 201);
const inbox = await (await call("/api/messages?user=%D7%A2%D7%9C%D7%9E%D7%94")).json();
assert.equal(inbox.messages.some((message) => message.body === "בדיקת הודעה"), true);
const directMessage = inbox.messages.find((message) => message.body === "בדיקת הודעה");
assert.equal(directMessage.readAt, null);
assert.equal((await call(`/api/messages/${directMessage.id}/read`, {
  method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ user: "גלעד" }),
})).status, 404);
assert.equal((await call(`/api/messages/${directMessage.id}/read`, {
  method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ user: "עלמה" }),
})).status, 200);
const readInbox = await (await call("/api/messages?user=%D7%A2%D7%9C%D7%9E%D7%94")).json();
assert.equal(Boolean(readInbox.messages.find((message) => message.id === directMessage.id).readAt), true);

const recipeForm = new FormData();
recipeForm.set("recipe", JSON.stringify({ name: "מתכון בדיקה", author: "גלעד", origin: "סבתא", category: "קינוחים", ingredients: "קמח", steps: "מערבבים", glutenFree: true, dedication: "לאבא", dietaryTag: "חלבי", servings: "4 מנות" }));
recipeForm.set("images", new File([new Uint8Array([4, 5, 6])], "dish.jpg", { type: "image/jpeg" }));
recipeForm.set("video", new File([new Uint8Array([7, 8, 9])], "clip.mp4", { type: "video/mp4" }));
assert.equal((await call("/api/recipes", { method: "POST", body: recipeForm })).status, 201);

response = await call("/api/data");
let data = await response.json();
assert.equal(data.family.length, 2);
assert.equal(data.recipes.length, 1);
assert.equal(data.recipes[0].images.length, 1);
assert.equal(data.recipes[0].glutenFree, true);
assert.equal(data.recipes[0].origin, "סבתא");
assert.equal(data.recipes[0].dedication, "לאבא");
assert.equal(data.recipes[0].dietaryTag, "חלבי");
assert.equal(data.recipes[0].servings, "4 מנות");
assert.match(data.recipes[0].video, /^\/media\/recipes\//);

response = await call(`/api/recipes/${data.recipes[0].id}/family-tools`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ kids: true, golden: true, taste: { sweet: 4, salty: 1, spicy: 0, sour: 2 }, equipment: "תבנית", secretTip: "קמצוץ וניל" }) });
assert.equal(response.status, 200);
response = await call(`/api/recipes/${data.recipes[0].id}/cooks`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ cooks: [{ member: "עלמה", task: "קישוט" }] }) });
assert.equal(response.status, 200);
response = await call(`/api/recipes/${data.recipes[0].id}/learned`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ member: "עלמה" }) });
assert.equal(response.status, 200);
data = await (await call("/api/data")).json();
assert.equal(data.recipes[0].kids, true);
assert.equal(data.recipes[0].golden, true);
assert.deepEqual(data.recipes[0].taste, { sweet: 4, salty: 1, spicy: 0, sour: 2 });
assert.equal(data.recipes[0].equipment, "תבנית");
assert.equal(data.recipes[0].secretTip, "קמצוץ וניל");
assert.deepEqual(data.recipes[0].cooks, [{ member: "עלמה", task: "קישוט" }]);
assert.deepEqual(data.family.find(member => member.name === "עלמה").learnedRecipeIds, [data.recipes[0].id]);

response = await call(`/api/recipes/${data.recipes[0].id}/approvals`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ member: "גלעד" }) });
assert.equal(response.status, 400, "recipe authors cannot approve their own recipe");
response = await call(`/api/recipes/${data.recipes[0].id}/approvals`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ member: "עלמה" }) });
assert.equal(response.status, 200);
response = await call("/api/menus", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "ארוחת שבת", recipeIds: [data.recipes[0].id] }) });
assert.equal(response.status, 201);
const savedMenu = await response.json();
const storyForm = new FormData(); storyForm.set("author", "עלמה"); storyForm.set("title", "זיכרון מהמטבח"); storyForm.set("body", "כך היינו מכינים יחד את המתכון.");
response = await call("/api/stories", { method: "POST", body: storyForm });
assert.equal(response.status, 201);
data = await (await call("/api/data")).json();
assert.deepEqual(data.recipes[0].triedBy, ["עלמה"]);
assert.equal(data.menus[0].title, "ארוחת שבת");
assert.deepEqual(data.menus[0].recipeIds, [data.recipes[0].id]);
assert.equal(data.stories[0].author, "עלמה");
assert.equal(data.stories[0].title, "זיכרון מהמטבח");

const tryoutForm = new FormData(); tryoutForm.set("member", "עלמה"); tryoutForm.set("image", new File([new Uint8Array([3, 2, 1])], "tryout.jpg", { type: "image/jpeg" }));
response = await call(`/api/recipes/${data.recipes[0].id}/tryouts`, { method: "POST", body: tryoutForm });
assert.equal(response.status, 201);
data = await (await call("/api/data")).json();
assert.equal(data.recipes[0].tryouts[0].author, "עלמה");
assert.match(data.recipes[0].tryouts[0].image, /^\/media\/tryouts\//);

response = await call("/api/plans", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dayKey: "2026-09-26", recipeId: data.recipes[0].id, author: "גלעד" }) });
assert.equal(response.status, 201);
response = await call("/api/polls", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "מה נאכל?", options: ["פסטה", "מרק"] }) });
assert.equal(response.status, 201); const familyPoll = await response.json();
assert.equal((await call(`/api/polls/${familyPoll.poll.id}/vote`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ member: "עלמה", option: "מרק" }) })).status, 200);
response = await call("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "יום הולדת", eventDate: "2026-10-02", recipeId: data.recipes[0].id }) });
assert.equal(response.status, 201);
response = await call("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "מפגש משפחתי", eventDate: "2026-10-03" }) });
assert.equal(response.status, 201);
assert.equal((await response.json()).event.recipeId, null);
const memoryForm = new FormData(); memoryForm.set("author", "עלמה"); memoryForm.set("title", "ברכה מהמטבח"); memoryForm.set("body", "זיכרון משפחתי"); memoryForm.set("audio", new File([new Uint8Array([9, 8, 7])], "voice.webm", { type: "audio/webm" })); memoryForm.set("videoUrl", "https://www.youtube.com/watch?v=abc123xyz99");
response = await call("/api/memories", { method: "POST", body: memoryForm });
assert.equal(response.status, 201);
data = await (await call("/api/data")).json();
assert.equal(data.mealPlans[0].recipeId, data.recipes[0].id);
assert.equal(data.poll.votes["עלמה"], "מרק");
assert.equal(data.events[0].title, "יום הולדת");
assert.match(data.memories[0].audio, /^\/media\/memories\//);
assert.equal(data.memories[0].videoUrl, "https://www.youtube-nocookie.com/embed/abc123xyz99");
response = await call(data.memories[0].audio);
assert.equal(response.status, 200);
assert.equal(response.headers.get("content-type"), "audio/webm");
const badMemory = new FormData(); badMemory.set("author", "עלמה"); badMemory.set("title", "קישור לא מאושר"); badMemory.set("videoUrl", "https://example.com/watch?v=12345678901");
assert.equal((await call("/api/memories", { method: "POST", body: badMemory })).status, 400);

response = await call(`/api/recipes/${data.recipes[0].id}/comments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ author: "גלעד", body: "הוספתי מעט וניל" }) });
assert.equal(response.status, 201);
const comments = await (await call(`/api/recipes/${data.recipes[0].id}/comments`)).json();
assert.equal(comments.comments[0].body, "הוספתי מעט וניל");

response = await call(data.recipes[0].images[0]);
assert.equal(response.status, 200);
assert.equal(response.headers.get("content-type"), "image/jpeg");

response = await call(data.recipes[0].video);
assert.equal(response.status, 200);
assert.equal(response.headers.get("content-type"), "video/mp4");

const invalidVideoForm = new FormData(); invalidVideoForm.set("video", new File([new Uint8Array([1])], "bad.exe", { type: "application/octet-stream" }));
assert.equal((await call(`/api/recipes/${data.recipes[0].id}/video`, { method: "PUT", body: invalidVideoForm })).status, 400);

response = await call(`/api/recipes/${data.recipes[0].id}`, {
  method: "PUT", headers: { "content-type": "application/json" },
  body: JSON.stringify({ ...data.recipes[0], name: "מתכון שעודכן", origin: "סבתא רחל" }),
});
assert.equal(response.status, 200);
data = await (await call("/api/data")).json();
assert.equal(data.recipes[0].name, "מתכון שעודכן");
assert.equal(data.recipes[0].glutenFree, true);
assert.equal(data.recipes[0].origin, "סבתא רחל");

response = await call(`/api/recipes/${data.recipes[0].id}`, { method: "DELETE" });
assert.equal(response.status, 200);
data = await (await call("/api/data")).json();
assert.equal(data.recipes.length, 0);
assert.equal((await call(`/api/menus/${savedMenu.menu.id}`, { method: "DELETE" })).status, 200);
assert.equal([...objects.keys()].some((key) => key.startsWith("recipes/")), false);

const heroForm = new FormData();
heroForm.set("image", new File([new Uint8Array([7, 8, 9])], "hero.webp", { type: "image/webp" }));
response = await call("/api/hero-image", { method: "POST", body: heroForm });
assert.equal(response.status, 200);
data = await (await call("/api/data")).json();
assert.match(data.heroImage, /^\/media\/site\/hero\//);
assert.equal((await call(data.heroImage)).status, 200);

const logoForm = new FormData();
logoForm.set("image", new File([new Uint8Array([10, 11, 12])], "logo.png", { type: "image/png" }));
response = await call("/api/logo-image", { method: "POST", body: logoForm });
assert.equal(response.status, 200);
data = await (await call("/api/data")).json();
assert.match(data.logoImage, /^\/media\/site\/logo\//);
assert.equal((await call(data.logoImage)).status, 200);

console.log("PASS shared feedback, equal recipe image sizing, shared hero image editing, shared family, recipes, deletion, and image serving");
