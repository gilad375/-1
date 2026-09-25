import page from "./page.js";

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});
const plain = (value, status = 200) => new Response(value, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
const clean = (value, max = 5000) => String(value ?? "").trim().slice(0, max);
const mediaUrl = (key) => key ? `/media/${key.split("/").map(encodeURIComponent).join("/")}` : "";
const allowedImage = (file) => file instanceof File && file.size > 0 && file.size <= 3_000_000 && /^image\/(jpeg|png|webp|gif)$/i.test(file.type);
const allowedTryoutImage = allowedImage;
const allowedVideo = (file) => file instanceof File && file.size > 0 && file.size <= 5 * 1024 * 1024 && /^video\/(mp4|webm|quicktime|ogg)$/i.test(file.type);
const allowedAudio = (file) => file instanceof File && file.size > 0 && file.size <= 6 * 1024 * 1024 && /^audio\/(mpeg|mp4|webm|ogg|wav|x-wav|aac)$/i.test(file.type);

function recipeValues(input = {}) {
  return {
    name: clean(input.name, 120), author: clean(input.author, 80) || "המשפחה",
    category: clean(input.category, 50) || "ארוחות ערב", time: clean(input.time, 40),
    servings: clean(input.servings, 60), difficulty: clean(input.difficulty, 30) || "קל",
    origin: clean(input.origin, 80),
    dedication: clean(input.dedication, 120),
    dietaryTag: ["טבעוני", "צמחוני", "פרווה", "חלבי", "בשרי"].includes(clean(input.dietaryTag, 20)) ? clean(input.dietaryTag, 20) : "לא צוין",
    story: clean(input.story, 4000), ingredients: clean(input.ingredients, 12000), steps: clean(input.steps, 12000),
    glutenFree: input.glutenFree === true || input.glutenFree === 1 || input.glutenFree === "1",
  };
}

async function listData(env) {
  const [recipeRows, imageRows, familyRows, heroSetting, logoSetting, approvalRows, tryoutRows, menuRows, storyRows, planRows, pollRows, eventRows, memoryRows, ratingRows, toolsRows, cookRows, learningRows] = await Promise.all([
    env.DB.prepare("SELECT * FROM recipes ORDER BY created_at DESC").all(),
    env.DB.prepare("SELECT recipe_id, object_key, position FROM recipe_images ORDER BY position ASC").all(),
    env.DB.prepare("SELECT * FROM family_members ORDER BY created_at ASC").all(),
    env.DB.prepare("SELECT value FROM site_settings WHERE key='hero_image'").first(),
    env.DB.prepare("SELECT value FROM site_settings WHERE key='logo_image'").first(),
    env.DB.prepare("SELECT recipe_id,member_name FROM recipe_approvals ORDER BY created_at ASC").all(),
    env.DB.prepare("SELECT recipe_id,member_name,image_key,created_at FROM recipe_tryouts ORDER BY created_at DESC").all(),
    env.DB.prepare("SELECT * FROM family_menus ORDER BY created_at DESC").all(),
    env.DB.prepare("SELECT * FROM family_stories ORDER BY created_at DESC").all(),
    env.DB.prepare("SELECT * FROM family_meal_plans ORDER BY day_key ASC").all(),
    env.DB.prepare("SELECT * FROM family_polls ORDER BY created_at DESC LIMIT 1").all(),
    env.DB.prepare("SELECT * FROM family_events ORDER BY event_date ASC").all(),
    env.DB.prepare("SELECT * FROM family_memories ORDER BY created_at DESC").all(),
    env.DB.prepare("SELECT recipe_id,member_name,rating FROM recipe_ratings").all(),
    env.DB.prepare("SELECT * FROM recipe_family_tools").all(),
    env.DB.prepare("SELECT recipe_id,member_name,task FROM recipe_cooks ORDER BY created_at ASC").all(),
    env.DB.prepare("SELECT recipe_id,member_name FROM recipe_learnings ORDER BY created_at ASC").all(),
  ]);
  const imageMap = new Map();
  for (const row of imageRows.results) {
    if (!imageMap.has(row.recipe_id)) imageMap.set(row.recipe_id, []);
    imageMap.get(row.recipe_id).push(mediaUrl(row.object_key));
  }
  const approvalMap = new Map();
  for (const row of approvalRows.results) {
    if (!approvalMap.has(row.recipe_id)) approvalMap.set(row.recipe_id, []);
    approvalMap.get(row.recipe_id).push(row.member_name);
  }
  const tryoutMap = new Map();
  for (const row of tryoutRows.results) {
    if (!tryoutMap.has(row.recipe_id)) tryoutMap.set(row.recipe_id, []);
    tryoutMap.get(row.recipe_id).push({ author: row.member_name, image: mediaUrl(row.image_key), createdAt: new Date(row.created_at).toISOString() });
  }
  const ratingMap = new Map(); for (const row of ratingRows.results) { if (!ratingMap.has(row.recipe_id)) ratingMap.set(row.recipe_id, []); ratingMap.get(row.recipe_id).push({ member: row.member_name, value: row.rating }); }
  const toolsMap = new Map(toolsRows.results.map((row) => { let taste = {}; try { taste = JSON.parse(row.taste_json || "{}"); } catch {} return [row.recipe_id, { kids: Boolean(row.kids), golden: Boolean(row.golden), taste, equipment: row.equipment || "", secretTip: row.secret_tip || "" }]; }));
  const cooksMap = new Map(); for (const row of cookRows.results) { if (!cooksMap.has(row.recipe_id)) cooksMap.set(row.recipe_id, []); cooksMap.get(row.recipe_id).push({ member: row.member_name, task: row.task }); }
  const learningMap = new Map(); for (const row of learningRows.results) { if (!learningMap.has(row.member_name)) learningMap.set(row.member_name, []); learningMap.get(row.member_name).push(row.recipe_id); }
  return {
    recipes: recipeRows.results.map((r) => ({
      id: r.id, name: r.name, author: r.author, category: r.category, time: r.time,
      servings: r.servings, difficulty: r.difficulty, story: r.story, origin: r.origin || "", dedication: r.dedication || "", dietaryTag: r.dietary_tag || "לא צוין",
      ingredients: r.ingredients, steps: r.steps, glutenFree: Boolean(r.gluten_free), createdAt: new Date(r.created_at).toISOString(),
      images: imageMap.get(r.id) || [], video: mediaUrl(r.video_key), triedBy: approvalMap.get(r.id) || [], tryouts: tryoutMap.get(r.id) || [], ratings: ratingMap.get(r.id) || [],
      ...(toolsMap.get(r.id) || { kids: false, golden: false, taste: {}, equipment: "", secretTip: "" }), cooks: cooksMap.get(r.id) || [],
    })),
    family: familyRows.results.map((m) => ({ id: m.id, name: m.name, bio: m.bio, photo: mediaUrl(m.photo_key), learnedRecipeIds: learningMap.get(m.name) || [] })),
    heroImage: mediaUrl(heroSetting?.value),
    logoImage: mediaUrl(logoSetting?.value),
    menus: menuRows.results.map((m) => ({ id: m.id, title: m.title, recipeIds: JSON.parse(m.recipe_ids), createdAt: new Date(m.created_at).toISOString() })),
    stories: storyRows.results.map((s) => ({ id: s.id, author: s.author_name, title: s.title, body: s.body, image: mediaUrl(s.image_key), createdAt: new Date(s.created_at).toISOString() })),
    mealPlans: planRows.results.map((p) => ({ id: p.id, dayKey: p.day_key, recipeId: p.recipe_id, author: p.author_name })),
    poll: pollRows.results[0] ? { id: pollRows.results[0].id, title: pollRows.results[0].title, options: JSON.parse(pollRows.results[0].options_json), votes: JSON.parse(pollRows.results[0].votes_json), createdAt: new Date(pollRows.results[0].created_at).toISOString() } : null,
    events: eventRows.results.map((e) => ({ id: e.id, title: e.title, eventDate: e.event_date, recipeId: e.recipe_id, createdAt: new Date(e.created_at).toISOString() })),
    memories: memoryRows.results.map((m) => ({ id: m.id, author: m.author_name, title: m.title, body: m.body, image: mediaUrl(m.image_key), audio: mediaUrl(m.audio_key), videoUrl: m.video_url || "", createdAt: new Date(m.created_at).toISOString() })),
  };
}

async function saveMealPlan(request, env) {
  const { dayKey, recipeId, author } = await request.json().catch(() => ({}));
  const day = clean(dayKey, 10), recipe = clean(recipeId, 80), member = clean(author, 80);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !recipe || !member) return json({ error: "PLAN_REQUIRED" }, 400);
  if (!await env.DB.prepare("SELECT id FROM family_members WHERE name=?").bind(member).first()) return json({ error: "UNKNOWN_USER" }, 400);
  if (!await env.DB.prepare("SELECT id FROM recipes WHERE id=?").bind(recipe).first()) return json({ error: "NOT_FOUND" }, 404);
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO family_meal_plans (id,day_key,recipe_id,author_name,created_at) VALUES (?,?,?,?,?)").bind(id, day, recipe, member, Date.now()).run();
  return json({ ok: true, plan: { id, dayKey: day, recipeId: recipe, author: member } }, 201);
}
async function deleteMealPlan(env, id) { const result = await env.DB.prepare("DELETE FROM family_meal_plans WHERE id=?").bind(id).run(); return result.meta.changes ? json({ ok: true }) : json({ error: "NOT_FOUND" }, 404); }
async function createFamilyPoll(request, env) {
  const input = await request.json().catch(() => ({})), title = clean(input.title, 160);
  const options = Array.isArray(input.options) ? [...new Set(input.options.map((x) => clean(x, 120)).filter(Boolean))].slice(0, 8) : [];
  if (!title || options.length < 2) return json({ error: "POLL_REQUIRED" }, 400);
  const id = crypto.randomUUID(), createdAt = Date.now();
  await env.DB.batch([env.DB.prepare("DELETE FROM family_polls"), env.DB.prepare("INSERT INTO family_polls (id,title,options_json,votes_json,created_at) VALUES (?,?,?,?,?)").bind(id, title, JSON.stringify(options), "{}", createdAt)]);
  return json({ ok: true, poll: { id, title, options, votes: {}, createdAt: new Date(createdAt).toISOString() } }, 201);
}
async function voteFamilyPoll(request, env, id) {
  const input = await request.json().catch(() => ({})), member = clean(input.member, 80), option = clean(input.option, 120);
  const row = await env.DB.prepare("SELECT * FROM family_polls WHERE id=?").bind(id).first();
  if (!row) return json({ error: "NOT_FOUND" }, 404);
  if (!member || !await env.DB.prepare("SELECT id FROM family_members WHERE name=?").bind(member).first()) return json({ error: "UNKNOWN_USER" }, 400);
  const options = JSON.parse(row.options_json); if (!options.includes(option)) return json({ error: "INVALID_OPTION" }, 400);
  const votes = JSON.parse(row.votes_json); votes[member] = option;
  await env.DB.prepare("UPDATE family_polls SET votes_json=? WHERE id=?").bind(JSON.stringify(votes), id).run();
  return json({ ok: true });
}
async function saveFamilyEvent(request, env) {
  const input = await request.json().catch(() => ({})), title = clean(input.title, 120), eventDate = clean(input.eventDate, 10), recipeId = clean(input.recipeId, 80) || null;
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return json({ error: "EVENT_REQUIRED" }, 400);
  const today = new Date().toISOString().slice(0, 10), latest = new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10);
  if (eventDate < today || eventDate > latest) return json({ error: "EVENT_DATE_OUT_OF_RANGE" }, 400);
  if (recipeId && !await env.DB.prepare("SELECT id FROM recipes WHERE id=?").bind(recipeId).first()) return json({ error: "NOT_FOUND" }, 404);
  const id = crypto.randomUUID(); await env.DB.prepare("INSERT INTO family_events (id,title,event_date,recipe_id,created_at) VALUES (?,?,?,?,?)").bind(id, title, eventDate, recipeId, Date.now()).run();
  return json({ ok: true, event: { id, title, eventDate, recipeId } }, 201);
}
async function deleteFamilyEvent(env, id) { const result = await env.DB.prepare("DELETE FROM family_events WHERE id=?").bind(id).run(); return result.meta.changes ? json({ ok: true }) : json({ error: "NOT_FOUND" }, 404); }
async function saveFamilyMemory(request, env) {
  const form = await request.formData(), author = clean(form.get("author"), 80), title = clean(form.get("title"), 120), body = clean(form.get("body"), 1800);
  const image = form.get("image"), audio = form.get("audio"), rawVideo = clean(form.get("videoUrl"), 500);
  let videoUrl = "";
  if (rawVideo) { try { const url = new URL(rawVideo); let videoId = ""; if (url.hostname === "youtu.be") videoId = url.pathname.slice(1).split("/")[0]; else if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) videoId = url.searchParams.get("v") || url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1] || ""; if (/^[\w-]{11}$/.test(videoId)) videoUrl = `https://www.youtube-nocookie.com/embed/${videoId}`; } catch {} }
  if (!author || !title || !await env.DB.prepare("SELECT id FROM family_members WHERE name=?").bind(author).first()) return json({ error: author ? "UNKNOWN_USER" : "STORY_REQUIRED" }, 400);
  if (image instanceof File && image.size && !allowedImage(image)) return json({ error: "INVALID_IMAGE" }, 400);
  if (audio instanceof File && audio.size && !allowedAudio(audio)) return json({ error: "INVALID_AUDIO" }, 400);
  if (!body && !(image instanceof File && image.size) && !(audio instanceof File && audio.size) && !videoUrl) return json({ error: "STORY_REQUIRED" }, 400);
  const id = crypto.randomUUID(), createdAt = Date.now(); let imageKey = null, audioKey = null;
  try {
    if (image instanceof File && image.size) imageKey = await storeImage(env, image, `memories/${id}`);
    if (audio instanceof File && audio.size) { const ext = ({"audio/mpeg":"mp3","audio/mp4":"m4a","audio/webm":"webm","audio/ogg":"ogg","audio/wav":"wav","audio/x-wav":"wav","audio/aac":"aac"})[audio.type]; audioKey=`memories/${id}/${crypto.randomUUID()}.${ext}`; await env.BUCKET.put(audioKey,audio.stream(),{httpMetadata:{contentType:audio.type,cacheControl:"public, max-age=31536000, immutable"}}); }
    await env.DB.prepare("INSERT INTO family_memories (id,author_name,title,body,image_key,audio_key,video_url,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(id, author, title, body, imageKey, audioKey, videoUrl, createdAt).run();
    return json({ ok:true, memory:{id,author,title,body,image:mediaUrl(imageKey),audio:mediaUrl(audioKey),videoUrl,createdAt:new Date(createdAt).toISOString()} },201);
  } catch(error) { if(imageKey) await env.BUCKET.delete(imageKey).catch(()=>{});if(audioKey) await env.BUCKET.delete(audioKey).catch(()=>{});console.error("save family memory failed",error);return json({error:"SAVE_FAILED"},500); }
}

async function approveRecipe(request, env, recipeId) {
  if (!await env.DB.prepare("SELECT id FROM recipes WHERE id=?").bind(recipeId).first()) return json({ error: "NOT_FOUND" }, 404);
  const { member } = await request.json().catch(() => ({}));
  const name = clean(member, 80);
  const recipe = await env.DB.prepare("SELECT author FROM recipes WHERE id=?").bind(recipeId).first();
  if (!name) return json({ error: "AUTHOR_REQUIRED" }, 400);
  if (name === recipe.author) return json({ error: "OWN_RECIPE" }, 400);
  if (!await env.DB.prepare("SELECT id FROM family_members WHERE name=?").bind(name).first()) return json({ error: "UNKNOWN_USER" }, 400);
  const existing = await env.DB.prepare("SELECT id FROM recipe_approvals WHERE recipe_id=? AND member_name=?").bind(recipeId, name).first();
  if (!existing) await env.DB.prepare("INSERT INTO recipe_approvals (id,recipe_id,member_name,created_at) VALUES (?,?,?,?)").bind(crypto.randomUUID(), recipeId, name, Date.now()).run();
  return json({ ok: true });
}

async function saveMenu(request, env) {
  const input = await request.json().catch(() => ({}));
  const title = clean(input.title, 100);
  const recipeIds = Array.isArray(input.recipeIds) ? [...new Set(input.recipeIds.map((x) => clean(x, 80)))].slice(0, 40) : [];
  if (!title) return json({ error: "NAME_REQUIRED" }, 400);
  if (!recipeIds.length) return json({ error: "MENU_EMPTY" }, 400);
  const placeholders = recipeIds.map(() => "?").join(",");
  const existing = (await env.DB.prepare(`SELECT id FROM recipes WHERE id IN (${placeholders})`).bind(...recipeIds).all()).results.map((row) => row.id);
  if (existing.length !== recipeIds.length) return json({ error: "INVALID_RECIPES" }, 400);
  const id = crypto.randomUUID(), createdAt = Date.now();
  await env.DB.prepare("INSERT INTO family_menus (id,title,recipe_ids,created_at) VALUES (?,?,?,?)").bind(id, title, JSON.stringify(recipeIds), createdAt).run();
  return json({ ok: true, menu: { id, title, recipeIds, createdAt: new Date(createdAt).toISOString() } }, 201);
}

async function deleteMenu(env, id) {
  const result = await env.DB.prepare("DELETE FROM family_menus WHERE id=?").bind(id).run();
  return result.meta.changes ? json({ ok: true }) : json({ error: "NOT_FOUND" }, 404);
}

async function saveStory(request, env) {
  const form = await request.formData();
  const author = clean(form.get("author"), 80), title = clean(form.get("title"), 120), body = clean(form.get("body"), 3000);
  if (!author || !title || !body) return json({ error: "STORY_REQUIRED" }, 400);
  if (!await env.DB.prepare("SELECT id FROM family_members WHERE name=?").bind(author).first()) return json({ error: "UNKNOWN_USER" }, 400);
  const file = form.get("image");
  if (file instanceof File && file.size && !allowedImage(file)) return json({ error: "INVALID_IMAGE" }, 400);
  const id = crypto.randomUUID(), createdAt = Date.now(); let imageKey = null;
  try {
    if (file instanceof File && file.size) imageKey = await storeImage(env, file, `stories/${id}`);
    await env.DB.prepare("INSERT INTO family_stories (id,author_name,title,body,image_key,created_at) VALUES (?,?,?,?,?,?)").bind(id, author, title, body, imageKey, createdAt).run();
    return json({ ok: true, story: { id, author, title, body, image: mediaUrl(imageKey), createdAt: new Date(createdAt).toISOString() } }, 201);
  } catch (error) {
    if (imageKey) await env.BUCKET.delete(imageKey).catch(() => {});
    console.error("save family story failed", error);
    return json({ error: "SAVE_FAILED" }, 500);
  }
}

async function storeImage(env, file, prefix) {
  if (!allowedImage(file)) throw new Error("INVALID_IMAGE");
  const ext = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" })[file.type] || "jpg";
  const key = `${prefix}/${crypto.randomUUID()}.${ext}`;
  await env.BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" },
  });
  return key;
}

async function storeVideo(env, file, prefix) {
  if (!allowedVideo(file)) throw new Error("INVALID_VIDEO");
  const ext = ({ "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "video/ogg": "ogv" })[file.type];
  const key = `${prefix}/${crypto.randomUUID()}.${ext}`;
  await env.BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" },
  });
  return key;
}

async function createRecipe(request, env) {
  const form = await request.formData();
  let input;
  try { input = JSON.parse(String(form.get("recipe") || "{}")); } catch { return json({ error: "INVALID_RECIPE" }, 400); }
  const value = recipeValues(input);
  if (!value.name) return json({ error: "NAME_REQUIRED" }, 400);
  const files = form.getAll("images").filter((x) => x instanceof File && x.size > 0);
  if (files.length > 5 || files.some((file) => !allowedImage(file))) return json({ error: "INVALID_IMAGES" }, 400);
  const videoFile = form.get("video");
  if (videoFile instanceof File && videoFile.size > 0 && !allowedVideo(videoFile)) return json({ error: "INVALID_VIDEO" }, 400);
  const id = crypto.randomUUID();
  const keys = [];
  let videoKey = null;
  try {
    for (const file of files) keys.push(await storeImage(env, file, `recipes/${id}`));
    if (videoFile instanceof File && videoFile.size > 0) videoKey = await storeVideo(env, videoFile, `recipes/${id}`);
    const statements = [env.DB.prepare(`INSERT INTO recipes
      (id,name,author,category,time,servings,difficulty,story,ingredients,steps,gluten_free,created_at,origin,video_key,dedication,dietary_tag)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, value.name, value.author, value.category, value.time, value.servings, value.difficulty, value.story, value.ingredients, value.steps, value.glutenFree ? 1 : 0, Date.now(), value.origin, videoKey, value.dedication, value.dietaryTag)];
    keys.forEach((key, position) => statements.push(env.DB.prepare("INSERT INTO recipe_images (id,recipe_id,object_key,position) VALUES (?,?,?,?)").bind(crypto.randomUUID(), id, key, position)));
    await env.DB.batch(statements);
    return json({ ok: true, id }, 201);
  } catch (error) {
    await Promise.allSettled(keys.map((key) => env.BUCKET.delete(key)));
    if (videoKey) await env.BUCKET.delete(videoKey).catch(() => {});
    console.error("create recipe failed", error);
    return json({ error: "SAVE_FAILED" }, 500);
  }
}

async function updateRecipe(request, env, id) {
  const value = recipeValues(await request.json());
  if (!value.name) return json({ error: "NAME_REQUIRED" }, 400);
  const result = await env.DB.prepare(`UPDATE recipes SET name=?,author=?,category=?,time=?,servings=?,difficulty=?,story=?,ingredients=?,steps=?,gluten_free=?,origin=?,dedication=?,dietary_tag=? WHERE id=?`)
    .bind(value.name, value.author, value.category, value.time, value.servings, value.difficulty, value.story, value.ingredients, value.steps, value.glutenFree ? 1 : 0, value.origin, value.dedication, value.dietaryTag, id).run();
  return result.meta.changes ? json({ ok: true }) : json({ error: "NOT_FOUND" }, 404);
}

async function replaceRecipeVideo(request, env, id) {
  const current = await env.DB.prepare("SELECT video_key FROM recipes WHERE id=?").bind(id).first();
  if (!current) return json({ error: "NOT_FOUND" }, 404);
  const form = await request.formData();
  const file = form.get("video");
  if (!(file instanceof File) || !allowedVideo(file)) return json({ error: "INVALID_VIDEO" }, 400);
  let nextKey = null;
  try {
    nextKey = await storeVideo(env, file, `recipes/${id}`);
    await env.DB.prepare("UPDATE recipes SET video_key=? WHERE id=?").bind(nextKey, id).run();
    if (current.video_key) await env.BUCKET.delete(current.video_key).catch(() => {});
    return json({ ok: true, video: mediaUrl(nextKey) });
  } catch (error) {
    if (nextKey) await env.BUCKET.delete(nextKey).catch(() => {});
    console.error("replace recipe video failed", error);
    return json({ error: "SAVE_FAILED" }, 500);
  }
}

async function deleteRecipe(env, id) {
  const recipe = await env.DB.prepare("SELECT video_key FROM recipes WHERE id=?").bind(id).first();
  const images = (await env.DB.prepare("SELECT object_key FROM recipe_images WHERE recipe_id=?").bind(id).all()).results;
  const tryouts = (await env.DB.prepare("SELECT image_key FROM recipe_tryouts WHERE recipe_id=?").bind(id).all()).results;
  const result = await env.DB.prepare("DELETE FROM recipes WHERE id=?").bind(id).run();
  if (!result.meta.changes) return json({ error: "NOT_FOUND" }, 404);
  await Promise.allSettled(images.map((image) => env.BUCKET.delete(image.object_key)));
  await Promise.allSettled(tryouts.map((image) => env.BUCKET.delete(image.image_key)));
  if (recipe?.video_key) await env.BUCKET.delete(recipe.video_key).catch(() => {});
  return json({ ok: true });
}

async function saveRecipeTryout(request, env, recipeId) {
  if (!await env.DB.prepare("SELECT id FROM recipes WHERE id=?").bind(recipeId).first()) return json({ error: "NOT_FOUND" }, 404);
  const form = await request.formData(), member = clean(form.get("member"), 80), file = form.get("image");
  if (!member) return json({ error: "AUTHOR_REQUIRED" }, 400);
  if (!await env.DB.prepare("SELECT id FROM family_members WHERE name=?").bind(member).first()) return json({ error: "UNKNOWN_USER" }, 400);
  if (!(file instanceof File) || !allowedTryoutImage(file)) return json({ error: "INVALID_IMAGE" }, 400);
  const id = crypto.randomUUID(), createdAt = Date.now(); let imageKey;
  try {
    imageKey = await storeImage(env, file, `tryouts/${recipeId}`);
    await env.DB.prepare("INSERT INTO recipe_tryouts (id,recipe_id,member_name,image_key,created_at) VALUES (?,?,?,?,?)").bind(id, recipeId, member, imageKey, createdAt).run();
    return json({ ok: true, tryout: { id, author: member, image: mediaUrl(imageKey), createdAt: new Date(createdAt).toISOString() } }, 201);
  } catch (error) {
    if (imageKey) await env.BUCKET.delete(imageKey).catch(() => {});
    console.error("save recipe tryout failed", error);
    return json({ error: "SAVE_FAILED" }, 500);
  }
}

async function recipeComments(env, recipeId) {
  const rows = await env.DB.prepare("SELECT id,author_name,body,created_at FROM recipe_comments WHERE recipe_id=? ORDER BY created_at ASC").bind(recipeId).all();
  return json({ comments: rows.results.map((row) => ({ id: row.id, author: row.author_name, body: row.body, createdAt: new Date(row.created_at).toISOString() })) });
}

async function addRecipeComment(request, env, recipeId) {
  if (!await env.DB.prepare("SELECT id FROM recipes WHERE id=?").bind(recipeId).first()) return json({ error: "NOT_FOUND" }, 404);
  const input = await request.json().catch(() => ({}));
  const author = clean(input.author, 80), body = clean(input.body, 500);
  if (!author) return json({ error: "AUTHOR_REQUIRED" }, 400);
  if (!body) return json({ error: "COMMENT_REQUIRED" }, 400);
  const known = await env.DB.prepare("SELECT name FROM family_members WHERE name=?").bind(author).first();
  if (!known) return json({ error: "UNKNOWN_USER" }, 400);
  const id = crypto.randomUUID(), createdAt = Date.now();
  await env.DB.prepare("INSERT INTO recipe_comments (id,recipe_id,author_name,body,created_at) VALUES (?,?,?,?,?)").bind(id, recipeId, author, body, createdAt).run();
  return json({ ok: true, comment: { id, author, body, createdAt: new Date(createdAt).toISOString() } }, 201);
}

async function rateRecipe(request, env, recipeId) {
  const input = await request.json().catch(() => ({})), member = clean(input.member, 80), rating = Number(input.rating);
  if (!member || !Number.isInteger(rating) || rating < 1 || rating > 5) return json({ error: "RATING_REQUIRED" }, 400);
  if (!await env.DB.prepare("SELECT id FROM family_members WHERE name=?").bind(member).first()) return json({ error: "UNKNOWN_USER" }, 400);
  await env.DB.prepare("INSERT INTO recipe_ratings (id,recipe_id,member_name,rating,created_at) VALUES (?,?,?,?,?) ON CONFLICT(recipe_id,member_name) DO UPDATE SET rating=excluded.rating")
    .bind(crypto.randomUUID(), recipeId, member, rating, Date.now()).run(); return json({ ok: true });
}

async function saveRecipeFamilyTools(request, env, recipeId) {
  if (!await env.DB.prepare("SELECT id FROM recipes WHERE id=?").bind(recipeId).first()) return json({ error: "NOT_FOUND" }, 404);
  const input = await request.json().catch(() => ({}));
  const taste = {};
  for (const key of ["sweet", "salty", "spicy", "sour"]) taste[key] = Math.max(0, Math.min(5, Math.round(Number(input.taste?.[key]) || 0)));
  await env.DB.prepare("INSERT INTO recipe_family_tools (recipe_id,kids,golden,taste_json,equipment,secret_tip) VALUES (?,?,?,?,?,?) ON CONFLICT(recipe_id) DO UPDATE SET kids=excluded.kids,golden=excluded.golden,taste_json=excluded.taste_json,equipment=excluded.equipment,secret_tip=excluded.secret_tip")
    .bind(recipeId, input.kids ? 1 : 0, input.golden ? 1 : 0, JSON.stringify(taste), clean(input.equipment, 500), clean(input.secretTip, 500)).run();
  return json({ ok: true });
}

async function saveRecipeCooks(request, env, recipeId) {
  if (!await env.DB.prepare("SELECT id FROM recipes WHERE id=?").bind(recipeId).first()) return json({ error: "NOT_FOUND" }, 404);
  const input = await request.json().catch(() => ({})), cooks = Array.isArray(input.cooks) ? input.cooks.slice(0, 20) : [];
  for (const cook of cooks) {
    const member = clean(cook.member, 80);
    if (!member || !await env.DB.prepare("SELECT id FROM family_members WHERE name=?").bind(member).first()) return json({ error: "UNKNOWN_USER" }, 400);
  }
  const statements = [env.DB.prepare("DELETE FROM recipe_cooks WHERE recipe_id=?").bind(recipeId)];
  cooks.forEach((cook) => statements.push(env.DB.prepare("INSERT INTO recipe_cooks (recipe_id,member_name,task,created_at) VALUES (?,?,?,?)").bind(recipeId, clean(cook.member, 80), clean(cook.task, 120), Date.now())));
  await env.DB.batch(statements);
  return json({ ok: true });
}

async function saveRecipeLearning(request, env, recipeId) {
  if (!await env.DB.prepare("SELECT id FROM recipes WHERE id=?").bind(recipeId).first()) return json({ error: "NOT_FOUND" }, 404);
  const input = await request.json().catch(() => ({})), member = clean(input.member, 80);
  if (!member || !await env.DB.prepare("SELECT id FROM family_members WHERE name=?").bind(member).first()) return json({ error: "UNKNOWN_USER" }, 400);
  await env.DB.prepare("INSERT INTO recipe_learnings (recipe_id,member_name,created_at) VALUES (?,?,?) ON CONFLICT(recipe_id,member_name) DO NOTHING").bind(recipeId, member, Date.now()).run();
  return json({ ok: true });
}

async function replaceRecipeImages(request, env, id) {
  if (!await env.DB.prepare("SELECT id FROM recipes WHERE id=?").bind(id).first()) return json({ error: "NOT_FOUND" }, 404);
  const form = await request.formData();
  let keep = [];
  try { keep = JSON.parse(String(form.get("keep") || "[]")); } catch { keep = []; }
  keep = keep.map((url) => decodeURIComponent(String(url).replace(/^\/media\//, "")))
    .filter((key) => key.startsWith(`recipes/${id}/`)).slice(0, 5);
  const files = form.getAll("images").filter((x) => x instanceof File && x.size > 0);
  if (keep.length + files.length > 5 || files.some((file) => !allowedImage(file))) return json({ error: "INVALID_IMAGES" }, 400);
  const current = (await env.DB.prepare("SELECT object_key FROM recipe_images WHERE recipe_id=?").bind(id).all()).results.map((r) => r.object_key);
  const added = [];
  try {
    for (const file of files) added.push(await storeImage(env, file, `recipes/${id}`));
    const next = [...keep, ...added];
    const statements = [env.DB.prepare("DELETE FROM recipe_images WHERE recipe_id=?").bind(id)];
    next.forEach((key, position) => statements.push(env.DB.prepare("INSERT INTO recipe_images (id,recipe_id,object_key,position) VALUES (?,?,?,?)").bind(crypto.randomUUID(), id, key, position)));
    await env.DB.batch(statements);
    await Promise.allSettled(current.filter((key) => !next.includes(key)).map((key) => env.BUCKET.delete(key)));
    return json({ ok: true });
  } catch (error) {
    await Promise.allSettled(added.map((key) => env.BUCKET.delete(key)));
    console.error("replace images failed", error);
    return json({ error: "SAVE_FAILED" }, 500);
  }
}

async function addFamilyMember(request, env) {
  const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM family_members").first();
  if (Number(count.total) >= 20) return json({ error: "FAMILY_FULL" }, 409);
  const form = await request.formData();
  const name = clean(form.get("name"), 80);
  const bio = clean(form.get("bio"), 300);
  if (!name) return json({ error: "NAME_REQUIRED" }, 400);
  if (await env.DB.prepare("SELECT id FROM family_members WHERE name=?").bind(name).first()) return json({ error: "DUPLICATE_NAME" }, 409);
  const id = crypto.randomUUID();
  const file = form.get("photo");
  let photoKey = null;
  try {
    if (file instanceof File && file.size) photoKey = await storeImage(env, file, `family/${id}`);
    await env.DB.prepare("INSERT INTO family_members (id,name,bio,photo_key,created_at) VALUES (?,?,?,?,?)").bind(id, name, bio, photoKey, Date.now()).run();
    return json({ ok: true, id }, 201);
  } catch (error) {
    if (photoKey) await env.BUCKET.delete(photoKey).catch(() => {});
    console.error("add family failed", error);
    return json({ error: error.message === "INVALID_IMAGE" ? "INVALID_IMAGE" : "SAVE_FAILED" }, error.message === "INVALID_IMAGE" ? 400 : 500);
  }
}

async function renameFamilyMember(request, env, memberId) {
  const input = await request.json().catch(() => ({}));
  const name = clean(input.name, 80);
  if (!name) return json({ error: "NAME_REQUIRED" }, 400);
  const member = await env.DB.prepare("SELECT name FROM family_members WHERE id=?").bind(memberId).first();
  if (!member) return json({ error: "FAMILY_MEMBER_NOT_FOUND" }, 404);
  if (member.name === name) return json({ ok: true, name });
  const duplicate = await env.DB.prepare("SELECT id FROM family_members WHERE name=? AND id<>?").bind(name, memberId).first();
  if (duplicate) return json({ error: "DUPLICATE_NAME" }, 409);
  await env.DB.batch([
    env.DB.prepare("UPDATE family_members SET name=? WHERE id=?").bind(name, memberId),
    env.DB.prepare("UPDATE recipes SET author=? WHERE author=?").bind(name, member.name),
    env.DB.prepare("UPDATE messages SET sender_name=? WHERE sender_name=?").bind(name, member.name),
    env.DB.prepare("UPDATE messages SET recipient_name=? WHERE recipient_name=?").bind(name, member.name),
    env.DB.prepare("UPDATE feedback SET name=? WHERE name=?").bind(name, member.name),
    env.DB.prepare("UPDATE family_stories SET author_name=? WHERE author_name=?").bind(name, member.name),
  ]);
  return json({ ok: true, name });
}

async function updateHeroImage(request, env) {
  const form = await request.formData();
  const file = form.get("image");
  if (!allowedImage(file)) return json({ error: "INVALID_IMAGE" }, 400);
  const previous = await env.DB.prepare("SELECT value FROM site_settings WHERE key='hero_image'").first();
  let nextKey;
  try {
    nextKey = await storeImage(env, file, "site/hero");
    await env.DB.prepare(`INSERT INTO site_settings (key,value) VALUES ('hero_image',?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value`).bind(nextKey).run();
    if (previous?.value && previous.value !== nextKey) await env.BUCKET.delete(previous.value).catch(() => {});
    return json({ ok: true, image: mediaUrl(nextKey) });
  } catch (error) {
    if (nextKey) await env.BUCKET.delete(nextKey).catch(() => {});
    console.error("hero image failed", error);
    return json({ error: "SAVE_FAILED" }, 500);
  }
}

async function updateLogoImage(request, env) {
  const form = await request.formData();
  const file = form.get("image");
  if (!allowedImage(file)) return json({ error: "INVALID_IMAGE" }, 400);
  const previous = await env.DB.prepare("SELECT value FROM site_settings WHERE key='logo_image'").first();
  let nextKey;
  try {
    nextKey = await storeImage(env, file, "site/logo");
    await env.DB.prepare(`INSERT INTO site_settings (key,value) VALUES ('logo_image',?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value`).bind(nextKey).run();
    if (previous?.value && previous.value !== nextKey) await env.BUCKET.delete(previous.value).catch(() => {});
    return json({ ok: true, image: mediaUrl(nextKey) });
  } catch (error) {
    if (nextKey) await env.BUCKET.delete(nextKey).catch(() => {});
    console.error("logo image failed", error);
    return json({ error: "SAVE_FAILED" }, 500);
  }
}

async function saveFeedback(request, env) {
  const input = await request.json();
  const name = clean(input.name, 80) || "אנונימי";
  const type = clean(input.type, 30);
  const message = clean(input.message, 1500);
  if (!message) return json({ error: "FEEDBACK_REQUIRED" }, 400);
  if (!["משוב", "רעיון לשיפור", "נגישות", "פרטיות", "דיווח תוכן", "בקשת מחיקה"].includes(type)) return json({ error: "INVALID_FEEDBACK_TYPE" }, 400);
  const now = Date.now();
  const family = (await env.DB.prepare("SELECT name FROM family_members").all()).results.map((row) => row.name);
  const targets = [
    family.find((familyName) => familyName.includes("גלעד")) || "גלעד",
    family.find((familyName) => familyName.includes("עלמה")) || "עלמה",
  ];
  const statements = [env.DB.prepare("INSERT INTO feedback (id,name,type,message,created_at) VALUES (?,?,?,?,?)")
    .bind(crypto.randomUUID(), name, type, message, now)];
  [...new Set(targets)].forEach((recipient) => statements.push(env.DB.prepare("INSERT INTO messages (id,sender_name,recipient_name,body,kind,created_at) VALUES (?,?,?,?,?,?)")
    .bind(crypto.randomUUID(), name, recipient, `${type}: ${message}`, "feedback", now)));
  await env.DB.batch(statements);
  return json({ ok: true }, 201);
}

async function listMessages(env, url) {
  const user = clean(url.searchParams.get("user"), 80);
  if (!user) return json({ error: "USER_REQUIRED" }, 400);
  const rows = await env.DB.prepare(`SELECT id,sender_name,recipient_name,body,kind,created_at,read_at
    FROM messages WHERE recipient_name=? OR sender_name=? ORDER BY created_at DESC LIMIT 100`).bind(user, user).all();
  return json({ messages: rows.results.map((row) => ({
    id: row.id, sender: row.sender_name, recipient: row.recipient_name,
    body: row.body, kind: row.kind, createdAt: new Date(row.created_at).toISOString(),
    readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
  })) });
}

async function sendMessage(request, env) {
  const input = await request.json();
  const sender = clean(input.sender, 80);
  const recipient = clean(input.recipient, 80);
  const body = clean(input.body, 1500);
  if (!sender || !recipient) return json({ error: "USER_REQUIRED" }, 400);
  if (!body) return json({ error: "MESSAGE_REQUIRED" }, 400);
  const known = await env.DB.prepare("SELECT name FROM family_members WHERE name IN (?,?)").bind(sender, recipient).all();
  if (new Set(known.results.map((row) => row.name)).size < (sender === recipient ? 1 : 2)) return json({ error: "UNKNOWN_USER" }, 400);
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO messages (id,sender_name,recipient_name,body,kind,created_at) VALUES (?,?,?,?,?,?)")
    .bind(id, sender, recipient, body, "direct", Date.now()).run();
  return json({ ok: true, id }, 201);
}

async function markMessageRead(request, env, messageId) {
  const input = await request.json().catch(() => ({}));
  const user = clean(input.user, 80);
  if (!user) return json({ error: "USER_REQUIRED" }, 400);
  const message = await env.DB.prepare("SELECT recipient_name,read_at FROM messages WHERE id=?").bind(messageId).first();
  if (!message || message.recipient_name !== user) return json({ error: "MESSAGE_NOT_FOUND" }, 404);
  const readAt = message.read_at || Date.now();
  if (!message.read_at) await env.DB.prepare("UPDATE messages SET read_at=? WHERE id=? AND recipient_name=?").bind(readAt, messageId, user).run();
  return json({ ok: true, readAt: new Date(readAt).toISOString() });
}

function dataUrlFile(dataUrl, name) {
  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/s.exec(dataUrl || "");
  if (!match) return null;
  const bytes = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0));
  if (bytes.byteLength > 3_000_000) return null;
  return new File([bytes], name, { type: match[1] });
}

async function importInitial(request, env) {
  const input = await request.json();
  const recipes = Array.isArray(input.recipes) ? input.recipes.slice(0, 100) : [];
  const family = Array.isArray(input.family) ? input.family.slice(0, 20) : [];
  for (const item of recipes) {
    const value = recipeValues(item);
    if (!value.name) continue;
    const existing = await env.DB.prepare("SELECT id FROM recipes WHERE name=? AND author=?").bind(value.name, value.author).first();
    if (existing) continue;
    const form = new FormData();
    form.set("recipe", JSON.stringify(value));
    const sources = Array.isArray(item.images) ? item.images : item.image ? [item.image] : [];
    sources.slice(0, 5).forEach((source, index) => { const file = dataUrlFile(source, `import-${index}.jpg`); if (file) form.append("images", file); });
    await createRecipe(new Request("https://local/api/recipes", { method: "POST", body: form }), env);
  }
  for (const member of family) {
    const form = new FormData(); form.set("name", clean(member.name, 80)); form.set("bio", clean(member.bio, 300));
    const file = dataUrlFile(member.photo, "profile.jpg"); if (file) form.set("photo", file);
    await addFamilyMember(new Request("https://local/api/family", { method: "POST", body: form }), env);
  }
  return json({ ok: true, imported: true });
}

async function serveMedia(env, pathname) {
  const key = pathname.slice("/media/".length).split("/").map(decodeURIComponent).join("/");
  if (!key || key.includes("..")) return plain("Not found", 404);
  const object = await env.BUCKET.get(key);
  if (!object) return plain("Not found", 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers); headers.set("etag", object.httpEtag); headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (!env.DB || !env.BUCKET) return json({ error: "STORAGE_UNAVAILABLE" }, 503);
      if (request.method === "GET" && url.pathname === "/") return new Response(page, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
      if (request.method === "GET" && url.pathname === "/api/data") return json(await listData(env));
      if (request.method === "POST" && url.pathname === "/api/plans") return saveMealPlan(request, env);
      const plan = /^\/api\/plans\/([^/]+)$/.exec(url.pathname);
      if (request.method === "DELETE" && plan) return deleteMealPlan(env, decodeURIComponent(plan[1]));
      if (request.method === "POST" && url.pathname === "/api/polls") return createFamilyPoll(request, env);
      const vote = /^\/api\/polls\/([^/]+)\/vote$/.exec(url.pathname);
      if (request.method === "POST" && vote) return voteFamilyPoll(request, env, decodeURIComponent(vote[1]));
      if (request.method === "POST" && url.pathname === "/api/events") return saveFamilyEvent(request, env);
      const event = /^\/api\/events\/([^/]+)$/.exec(url.pathname);
      if (request.method === "DELETE" && event) return deleteFamilyEvent(env, decodeURIComponent(event[1]));
      if (request.method === "POST" && url.pathname === "/api/memories") return saveFamilyMemory(request, env);
      const approvals = /^\/api\/recipes\/([^/]+)\/approvals$/.exec(url.pathname);
      if (request.method === "POST" && approvals) return approveRecipe(request, env, decodeURIComponent(approvals[1]));
      const tryouts = /^\/api\/recipes\/([^/]+)\/tryouts$/.exec(url.pathname);
      if (request.method === "POST" && tryouts) return saveRecipeTryout(request, env, decodeURIComponent(tryouts[1]));
      if (request.method === "POST" && url.pathname === "/api/menus") return saveMenu(request, env);
      const menu = /^\/api\/menus\/([^/]+)$/.exec(url.pathname);
      if (request.method === "DELETE" && menu) return deleteMenu(env, decodeURIComponent(menu[1]));
      if (request.method === "POST" && url.pathname === "/api/stories") return saveStory(request, env);
      if (request.method === "POST" && url.pathname === "/api/recipes") return createRecipe(request, env);
      const recipeVideo = /^\/api\/recipes\/([^/]+)\/video$/.exec(url.pathname);
      if (request.method === "PUT" && recipeVideo) return replaceRecipeVideo(request, env, decodeURIComponent(recipeVideo[1]));
      const comments = /^\/api\/recipes\/([^/]+)\/comments$/.exec(url.pathname);
      if (request.method === "GET" && comments) return recipeComments(env, decodeURIComponent(comments[1]));
      if (request.method === "POST" && comments) return addRecipeComment(request, env, decodeURIComponent(comments[1]));
      const ratings = /^\/api\/recipes\/([^/]+)\/ratings$/.exec(url.pathname);
      if (request.method === "POST" && ratings) return rateRecipe(request, env, decodeURIComponent(ratings[1]));
      const familyTools = /^\/api\/recipes\/([^/]+)\/family-tools$/.exec(url.pathname);
      if (request.method === "PUT" && familyTools) return saveRecipeFamilyTools(request, env, decodeURIComponent(familyTools[1]));
      const cooks = /^\/api\/recipes\/([^/]+)\/cooks$/.exec(url.pathname);
      if (request.method === "PUT" && cooks) return saveRecipeCooks(request, env, decodeURIComponent(cooks[1]));
      const learned = /^\/api\/recipes\/([^/]+)\/learned$/.exec(url.pathname);
      if (request.method === "POST" && learned) return saveRecipeLearning(request, env, decodeURIComponent(learned[1]));
      if (request.method === "POST" && url.pathname === "/api/family") return addFamilyMember(request, env);
      const familyName = /^\/api\/family\/([^/]+)\/name$/.exec(url.pathname);
      if (request.method === "PATCH" && familyName) return renameFamilyMember(request, env, decodeURIComponent(familyName[1]));
      if (request.method === "POST" && url.pathname === "/api/hero-image") return updateHeroImage(request, env);
      if (request.method === "POST" && url.pathname === "/api/logo-image") return updateLogoImage(request, env);
      if (request.method === "POST" && url.pathname === "/api/feedback") return saveFeedback(request, env);
      if (request.method === "GET" && url.pathname === "/api/messages") return listMessages(env, url);
      if (request.method === "POST" && url.pathname === "/api/messages") return sendMessage(request, env);
      const messageRead = /^\/api\/messages\/([^/]+)\/read$/.exec(url.pathname);
      if (request.method === "PATCH" && messageRead) return markMessageRead(request, env, decodeURIComponent(messageRead[1]));
      if (request.method === "POST" && url.pathname === "/api/import") return importInitial(request, env);
      const recipe = /^\/api\/recipes\/([^/]+)$/.exec(url.pathname);
      if (request.method === "PUT" && recipe) return updateRecipe(request, env, decodeURIComponent(recipe[1]));
      if (request.method === "DELETE" && recipe) return deleteRecipe(env, decodeURIComponent(recipe[1]));
      const images = /^\/api\/recipes\/([^/]+)\/images$/.exec(url.pathname);
      if (request.method === "PUT" && images) return replaceRecipeImages(request, env, decodeURIComponent(images[1]));
      if (request.method === "GET" && url.pathname.startsWith("/media/")) return serveMedia(env, url.pathname);
      return plain("Not found", 404);
    } catch (error) {
      console.error("request failed", error);
      return json({ error: "SERVER_ERROR" }, 500);
    }
  },
};
