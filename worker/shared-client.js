(() => {
  const localRecipes = (() => { try { return JSON.parse(localStorage.getItem(RECIPES_KEY) || "[]"); } catch { return []; } })();
  const localFamily = (() => { try { return JSON.parse(localStorage.getItem(FAMILY_KEY) || "[]"); } catch { return []; } })();
  const shared = { recipes: [], family: [], menus: [], stories: [], memories: [], mealPlans: [], poll: null, events: [], heroImage: "", logoImage: "", ready: false };
  const DEMO_USER_KEY = "familyCookbookDemoUser";
  let currentDemoUser = localStorage.getItem(DEMO_USER_KEY) || "";
  if (currentDemoUser === "גלעד טורדג'מן") {
    currentDemoUser = "גלעד";
    localStorage.setItem(DEMO_USER_KEY, currentDemoUser);
  }
  const id = (value) => encodeURIComponent(value);

  async function request(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(body.error || "REQUEST_FAILED");
        error.code = body.error;
        throw error;
      }
      return body;
    } catch (error) {
      if (error?.name === "AbortError") {
        const timeoutError = new Error("REQUEST_TIMEOUT");
        timeoutError.code = "REQUEST_TIMEOUT";
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function messageFor(error) {
    return ({
      FAMILY_FULL: "כבר יש 20 בני משפחה.", DUPLICATE_NAME: "כבר קיים בן משפחה בשם הזה.",
      INVALID_IMAGE: "אפשר לצרף תמונת JPG, PNG, WebP או GIF עד 3MB.",
      INVALID_IMAGES: "אפשר לצרף עד 5 תמונות, וכל תמונה צריכה להיות עד 3MB.",
      INVALID_VIDEO: "אפשר להעלות סרטון MP4, WebM, MOV או OGG עד 5MB ועד 30 שניות.",
      INVALID_AUDIO: "אפשר לצרף הקלטת MP3, M4A, WebM, OGG או WAV עד 6MB.", PLAN_REQUIRED: "צריך לבחור יום, מתכון ושם.", POLL_REQUIRED: "כתבו שאלה ולפחות שתי אפשרויות.", INVALID_OPTION: "האפשרות הזאת לא שייכת לסקר.", EVENT_REQUIRED: "מלאו שם ותאריך לאירוע.",
      NAME_REQUIRED: "צריך להוסיף שם.", AUTHOR_REQUIRED: "צריך לבחור או לכתוב את השם של מי שהוסיף/ה את המתכון.", FEEDBACK_REQUIRED: "צריך לכתוב משוב או רעיון.",
      COMMENT_REQUIRED: "צריך לכתוב תגובה.",
      OWN_RECIPE: "כדי לאשר מתכון, צריך בן משפחה נוסף שניסה אותו.", STORY_REQUIRED: "צריך לבחור שם ולמלא כותרת ותוכן לסיפור.", MENU_EMPTY: "בחרו לפחות מתכון אחד לתפריט.", INVALID_RECIPES: "אחד המתכונים בתפריט כבר אינו זמין.",
      USER_REQUIRED: "צריך לבחור משתמש.", MESSAGE_REQUIRED: "צריך לכתוב הודעה.", UNKNOWN_USER: "לא מצאנו את המשתמש הזה.",
      INVALID_FEEDBACK_TYPE: "צריך לבחור משוב או רעיון לשיפור.", STORAGE_UNAVAILABLE: "השמירה המשותפת אינה זמינה כרגע. נסו שוב בעוד רגע.",
    })[error.code] || "לא הצלחנו לשמור כרגע. הפרטים נשארו בטופס — נסו שוב.";
  }

  function dataUrlToBlob(value) {
    const [meta, encoded] = value.split(",");
    const type = /data:([^;]+)/.exec(meta)?.[1] || "image/jpeg";
    const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
    return new Blob([bytes], { type });
  }

  function updateSharedStats() {
    const recipes = shared.recipes;
    const valid = new Set(recipes.map((r) => r.id));
    const values = {
      recipes: recipes.length, family: shared.family.length,
      categories: new Set(recipes.map((r) => r.category).filter(Boolean)).size,
      saved: getFavorites().filter((savedId) => valid.has(savedId)).length,
    };
    Object.entries(values).forEach(([key, value]) => { const node = document.getElementById(`stat-${key}`); if (node) node.textContent = value; });
    const favorite = document.getElementById("favoriteCount"); if (favorite) favorite.textContent = values.saved;
  }

  function renderSharedFamily() {
    const list = document.getElementById("peopleList");
    if (!list) return;
    list.innerHTML = "";
    const everyoneCard = document.createElement("div");
    everyoneCard.className = `person personClickable${window.activeRecipeAuthor ? "" : " active"}`;
    everyoneCard.tabIndex = 0;
    everyoneCard.setAttribute("role", "button");
    everyoneCard.setAttribute("aria-label", "הצגת המתכונים של כולם");
    everyoneCard.onclick = () => window.clearRecipeAuthorFilter?.();
    everyoneCard.onkeydown = (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); everyoneCard.click(); } };
    const everyoneAvatar = document.createElement("div"); everyoneAvatar.className = "avatar"; everyoneAvatar.textContent = "👨‍👩‍👧‍👦";
    const everyoneName = document.createElement("b"); everyoneName.textContent = "כולם";
    everyoneCard.append(everyoneAvatar, everyoneName);
    list.appendChild(everyoneCard);
    shared.family.forEach((member) => {
      const card = document.createElement("div");
      card.className = `person personClickable${window.activeRecipeAuthor === member.name ? " active" : ""}`;
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `הצגת המתכונים של ${member.name}`);
      card.onclick = () => window.filterRecipesByAuthor?.(member.name);
      card.onkeydown = (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); card.click(); } };
      const avatar = document.createElement("div"); avatar.className = "avatar";
      if (member.photo) {
        const image = document.createElement("img"); image.src = member.photo; image.alt = `תמונה של ${member.name}`;
        image.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:50%"; avatar.appendChild(image);
      } else avatar.textContent = member.name.charAt(0);
      const name = document.createElement("b"); name.textContent = member.name;
      card.append(avatar, name);
      list.appendChild(card);
    });
    const note = document.getElementById("familyMessage");
    if (note) { note.textContent = `${shared.family.length} מתוך 20 משתמשים · משותף לכל מי שיש לו את הקישור${shared.family.length >= 16 ? ` · נותרו ${20-shared.family.length} מקומות` : ""}`; note.classList.toggle("familyNearLimit", shared.family.length >= 16); }
    const authorChoices = [...new Set([
      ...shared.family.map((member) => member.name),
      ...shared.recipes.map((recipe) => recipe.author),
    ].map((name) => String(name || "").trim()).filter(Boolean))];
    for (const selectId of ["recipeAuthor", "editRecipeAuthor"]) {
      const select = document.getElementById(selectId); if (!select) continue;
      const current = select.value; select.innerHTML = "";
      const prompt = document.createElement("option"); prompt.value = ""; prompt.textContent = "בחרו מי הוסיף/ה"; prompt.disabled = true; prompt.selected = !current; select.appendChild(prompt);
      authorChoices.forEach((name) => { const option = document.createElement("option"); option.value = name; option.textContent = name; select.appendChild(option); });
      const custom = document.createElement("option"); custom.value = "__custom__"; custom.textContent = "＋ הוספת שם חדש"; select.appendChild(custom);
      if ([...select.options].some((option) => option.value === current)) select.value = current;
      else if (current) { const option = document.createElement("option"); option.value = current; option.textContent = current; select.insertBefore(option, custom); select.value = current; }
      window.toggleCustomAuthor?.(selectId, `${selectId}CustomField`);
    }
    renderDemoUsers();
  }

  function renderDemoUsers() {
    const loginSelect = document.getElementById("demoUserSelect");
    const recipientSelect = document.getElementById("messageRecipient");
    const names = shared.family.map((member) => member.name);
    if (loginSelect) {
      loginSelect.innerHTML = '<option value="">בחרו שם</option>';
      names.forEach((name) => { const option = document.createElement("option"); option.value = name; option.textContent = name; loginSelect.appendChild(option); });
      const addName = document.createElement("option"); addName.value = "__new__"; addName.textContent = "＋ השם שלי לא ברשימה"; loginSelect.appendChild(addName);
    }
    if (!names.includes(currentDemoUser)) currentDemoUser = "";
    const login = document.getElementById("demoLogin");
    if (login) login.hidden = Boolean(currentDemoUser);
    const current = document.getElementById("currentDemoUser");
    if (current) current.textContent = currentDemoUser ? `שלום, ${currentDemoUser}` : "";
    if (recipientSelect) {
      recipientSelect.innerHTML = '<option value="">למי שולחים?</option>';
      names.filter((name) => name !== currentDemoUser).forEach((name) => { const option = document.createElement("option"); option.value = name; option.textContent = name; recipientSelect.appendChild(option); });
    }
    const feedbackName = document.getElementById("feedbackName");
    if (feedbackName && currentDemoUser && !feedbackName.value) feedbackName.value = currentDemoUser;
    window.toggleDemoNewName?.();
    if (currentDemoUser) refreshInbox(false).catch(() => {});
  }

  window.toggleDemoNewName = () => {
    const adding = document.getElementById("demoUserSelect")?.value === "__new__";
    const field = document.getElementById("demoNewNameField");
    if (field) field.hidden = !adding;
    if (adding) setTimeout(() => document.getElementById("demoNewName")?.focus(), 0);
  };

  window.demoSignIn = async () => {
    const selected = document.getElementById("demoUserSelect")?.value || "";
    if (!selected) { toast("צריך לבחור את השם שלכם"); return; }
    const adding = selected === "__new__";
    const name = adding ? (document.getElementById("demoNewName")?.value.trim() || "") : selected;
    if (!name) { toast("צריך לכתוב את השם שלכם"); document.getElementById("demoNewName")?.focus(); return; }
    const button = document.getElementById("demoSignInButton");
    if (button) { button.disabled = true; button.textContent = adding ? "מוסיף את השם…" : "נכנס…"; }
    try {
      if (adding) {
        const form = new FormData();
        form.set("name", name);
        form.set("bio", "נוסף/ה דרך מסך הכניסה");
        await request("/api/family", { method: "POST", body: form });
      }
      currentDemoUser = name;
      localStorage.setItem(DEMO_USER_KEY, name);
      if (adding) await refreshShared();
      else renderDemoUsers();
      const newName = document.getElementById("demoNewName"); if (newName) newName.value = "";
      toast(adding ? `השם ${name} נוסף בהצלחה. ברוכים הבאים!` : `שלום ${name}! נכנסת לאתר`);
    } catch (error) {
      if (adding && (error?.code === "REQUEST_TIMEOUT" || error?.code === "REQUEST_FAILED" || !error?.code)) {
        const updatedFamily = [...localFamily.filter(member => member.name !== name), { id: "local-" + Date.now(), name, bio: "נוסף/ה דרך מסך הכניסה", photo: "" }];
        localStorage.setItem(FAMILY_KEY, JSON.stringify(updatedFamily));
        shared.family = updatedFamily;
        currentDemoUser = name;
        localStorage.setItem(DEMO_USER_KEY, name);
        renderSharedFamily();
        toast("השם נשמר במכשיר. ננסה לסנכרן אותו עם הספר המשותף כשיהיה חיבור.");
      } else {
        toast(messageFor(error));
      }
    }
    finally { if (button) { button.disabled = false; button.textContent = "כניסה לאתר"; } }
  };

  window.demoLogout = () => {
    currentDemoUser = "";
    localStorage.removeItem(DEMO_USER_KEY);
    document.getElementById("inboxModal")?.classList.remove("open");
    const newName = document.getElementById("demoNewName"); if (newName) newName.value = "";
    renderDemoUsers();
  };

  function formatMessageDate(value) {
    try { return new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)); }
    catch { return ""; }
  }

  async function refreshInbox(showLoading = true) {
    if (!currentDemoUser) return;
    const list = document.getElementById("inboxList");
    if (showLoading && list) list.textContent = "טוען הודעות…";
    const data = await request(`/api/messages?user=${id(currentDemoUser)}`);
    const messages = data.messages || [];
    const count = document.getElementById("mailCount");
    const unread = messages.filter((message) => message.recipient === currentDemoUser && !message.readAt);
    if (count) { count.textContent = unread.length; count.hidden = !unread.length; }
    if (!list) return;
    list.innerHTML = "";
    if (!messages.length) { list.textContent = "עדיין אין הודעות בתיבה שלכם."; return; }
    messages.forEach((message) => {
      const item = document.createElement("article");
      const sent = message.sender === currentDemoUser;
      const isUnread = !sent && !message.readAt;
      item.className = `messageItem${sent ? " sent" : ""}${isUnread ? " unread" : ""}${message.kind === "feedback" ? " feedbackMessage" : ""}`;
      const meta = document.createElement("div"); meta.className = "messageMeta";
      const people = document.createElement("b"); people.textContent = sent ? `אל: ${message.recipient}` : `מאת: ${message.sender}`;
      const date = document.createElement("span"); date.textContent = formatMessageDate(message.createdAt);
      const body = document.createElement("div"); body.className = "messageBody"; body.textContent = message.body;
      meta.append(people, date); item.append(meta, body);
      const footer = document.createElement("div"); footer.className = "messageFooter";
      const state = document.createElement("span"); state.className = `messageState${isUnread ? " unreadState" : ""}`;
      state.textContent = sent ? (message.readAt ? "✓ נקראה" : "נשלחה · עדיין לא נקראה") : (message.readAt ? "✓ ראיתם" : "הודעה חדשה");
      footer.appendChild(state);
      if (!sent) {
        const actions = document.createElement("div"); actions.className = "messageActions";
        if (isUnread) {
          const seen = document.createElement("button"); seen.type = "button"; seen.className = "btn messageSeenButton"; seen.textContent = "✓ ראיתי";
          seen.onclick = () => window.markInboxMessage(message.id, seen);
          actions.appendChild(seen);
        }
        const reply = document.createElement("button"); reply.type = "button"; reply.className = "btn ghost messageReplyButton"; reply.textContent = "↩ לענות";
        reply.onclick = () => window.replyToMessage(message.id, message.sender, reply);
        actions.appendChild(reply); footer.appendChild(actions);
      }
      item.appendChild(footer); list.appendChild(item);
    });
  }

  async function markMessageRead(messageId, button, showToast = true) {
    if (button) button.disabled = true;
    try {
      await request(`/api/messages/${id(messageId)}/read`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ user: currentDemoUser }) });
      await refreshInbox(false);
      if (showToast) toast("סומן שראיתם את ההודעה");
      return true;
    } catch (error) { toast(messageFor(error)); return false; }
    finally { if (button) button.disabled = false; }
  }

  window.markInboxMessage = (messageId, button) => markMessageRead(messageId, button, true);

  window.replyToMessage = async (messageId, sender, button) => {
    const marked = await markMessageRead(messageId, button, false);
    if (!marked) return;
    const recipient = document.getElementById("messageRecipient");
    const body = document.getElementById("messageBody");
    if (recipient) recipient.value = sender;
    body?.focus();
    toast(`אפשר לכתוב עכשיו תשובה ל${sender}`);
  };

  window.openInbox = async () => {
    if (!currentDemoUser) { document.getElementById("demoLogin").hidden = false; return; }
    const owner = document.getElementById("inboxOwner"); if (owner) owner.textContent = `מחוברים בתור ${currentDemoUser}`;
    document.getElementById("inboxModal")?.classList.add("open");
    await refreshInbox();
  };
  window.closeInbox = () => document.getElementById("inboxModal")?.classList.remove("open");

  window.sendInboxMessage = async () => {
    const recipient = document.getElementById("messageRecipient")?.value || "";
    const body = document.getElementById("messageBody")?.value.trim() || "";
    if (!recipient) { toast("צריך לבחור למי לשלוח"); return; }
    if (!body) { toast("צריך לכתוב הודעה"); return; }
    const button = document.getElementById("messageSend"); if (button) button.disabled = true;
    try {
      await request("/api/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sender: currentDemoUser, recipient, body }) });
      document.getElementById("messageBody").value = "";
      await refreshInbox(false); toast("ההודעה נשלחה לתיבה באתר");
    } catch (error) { toast(messageFor(error)); }
    finally { if (button) button.disabled = false; }
  };

  window.toggleCustomAuthor = (selectId, fieldId) => {
    const select = document.getElementById(selectId);
    const field = document.getElementById(fieldId);
    const input = document.getElementById(`${selectId}Custom`);
    if (!select || !field) return;
    const isCustom = select.value === "__custom__";
    field.hidden = !isCustom;
    if (isCustom) input?.focus();
  };

  function chosenAuthor(selectId) {
    const selected = document.getElementById(selectId)?.value || "";
    return (selected === "__custom__" ? document.getElementById(`${selectId}Custom`)?.value : selected || "").trim();
  }

  window.continueToRecipeForm = () => {
    const author = chosenAuthor("recipeAuthor");
    if (!author) { toast("קודם צריך לבחור או לכתוב מי מוסיף/ה את המתכון"); return; }
    const authorStep = document.getElementById("recipeAuthorStep");
    const detailsStep = document.getElementById("recipeDetailsStep");
    if (authorStep) authorStep.hidden = true;
    if (detailsStep) detailsStep.hidden = false;
    document.getElementById("recipeName")?.focus();
  };

  window.backToAuthorQuestion = () => {
    const authorStep = document.getElementById("recipeAuthorStep");
    const detailsStep = document.getElementById("recipeDetailsStep");
    if (detailsStep) detailsStep.hidden = true;
    if (authorStep) authorStep.hidden = false;
    document.getElementById("recipeAuthor")?.focus();
  };

  function renderHeroImage() {
    const image = document.getElementById("heroImage");
    const placeholder = document.getElementById("heroPhotoPlaceholder");
    if (!image || !placeholder) return;
    if (shared.heroImage) {
      image.src = shared.heroImage;
      image.hidden = false;
      placeholder.hidden = true;
    } else {
      image.removeAttribute("src");
      image.hidden = true;
      placeholder.hidden = false;
    }
  }

  function renderSiteLogo() {
    const image = document.getElementById("siteLogoImage");
    const fallback = document.getElementById("siteLogoFallback");
    if (!image || !fallback) return;
    if (shared.logoImage) {
      image.src = shared.logoImage;
      image.hidden = false;
      fallback.hidden = true;
    } else {
      image.removeAttribute("src");
      image.hidden = true;
      fallback.hidden = false;
    }
  }

  async function refreshShared() {
    const previous = shared.recipes.map(r => r.createdAt || "").sort().at(-1) || "";
    const data = await request("/api/data");
    shared.recipes = data.recipes || [];
    shared.family = data.family || [];
    shared.menus = data.menus || [];
    shared.stories = data.stories || [];
    shared.memories = data.memories || []; shared.mealPlans = data.mealPlans || []; shared.poll = data.poll || null; shared.events = data.events || [];
    shared.heroImage = data.heroImage || "";
    shared.logoImage = data.logoImage || "";
    shared.ready = true;
    renderSharedFamily(); renderHeroImage(); renderSiteLogo(); renderRecipes(); updateSharedStats(); renderFeatureSuite();
    const newest = shared.recipes.map(r => r.createdAt || "").sort().at(-1) || "";
    if (previous && newest > previous) toast("🍲 נוסף מתכון חדש לספר המשפחתי!");
  }

  async function initializeShared() {
    // Render any locally cached family names immediately so the login screen never
    // stays on "טוען שמות…" while the shared API is loading.
    if (localFamily.length || localRecipes.length) {
      shared.family = localFamily;
      shared.recipes = localRecipes;
      renderSharedFamily();
      renderRecipes();
      updateSharedStats();
    } else {
      renderDemoUsers();
    }

    try {
      let data = await request("/api/data");
      if (!(data.recipes || []).length && localRecipes.length) {
        await request("/api/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recipes: localRecipes, family: localFamily }) });
        data = await request("/api/data");
      }
      localStorage.removeItem(RECIPES_KEY);
      localStorage.removeItem(FAMILY_KEY);
      shared.recipes = data.recipes || []; shared.family = data.family || []; shared.menus = data.menus || []; shared.stories = data.stories || []; shared.memories = data.memories || []; shared.mealPlans = data.mealPlans || []; shared.poll = data.poll || null; shared.events = data.events || []; shared.heroImage = data.heroImage || ""; shared.logoImage = data.logoImage || ""; shared.ready = true;
      renderSharedFamily(); renderHeroImage(); renderSiteLogo(); renderRecipes(); updateSharedStats(); renderFeatureSuite();
    } catch (error) {
      console.error(error);
      shared.ready = false;
      // Keep the local family list usable when the shared service is temporarily unavailable.
      shared.family = localFamily;
      shared.recipes = localRecipes;
      renderSharedFamily();
      renderRecipes();
      updateSharedStats();
      const note = document.getElementById("familyMessage");
      if (note) note.textContent = error?.code === "REQUEST_TIMEOUT"
        ? "החיבור לספר המשותף לוקח זמן. אפשר להיכנס עם השמות שכבר נשמרו במכשיר ולנסות שוב אחר כך."
        : "לא הצלחנו לטעון כרגע את הספר המשותף. אפשר להיכנס עם השמות שנשמרו במכשיר ולרענן שוב.";
      toast("הספר נטען במצב מקומי זמני. אפשר לרענן שוב בעוד רגע.");
    }
  }

  window.getRecipes = () => shared.ready ? shared.recipes : localRecipes;
  window.getFamily = () => shared.ready ? shared.family : localFamily;
  window.setRecipes = () => false;
  window.setFamily = () => false;
  window.renderFamily = renderSharedFamily;
  window.updateFavoriteCount = updateSharedStats;

  window.updateHeroImage = async (input) => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 1600, 0.78);
      const form = new FormData();
      form.set("image", dataUrlToBlob(compressed), "hero.jpg");
      toast("שומר את תמונת דף הבית…");
      await request("/api/hero-image", { method: "POST", body: form });
      await refreshShared();
      toast("תמונת דף הבית עודכנה אצל כולם");
    } catch (error) { toast(messageFor(error)); }
    finally { input.value = ""; }
  };

  window.addUser = async () => {
    if (window.addingFamilyMember) return;
    const name = document.getElementById("userName").value.trim();
    const bio = document.getElementById("userBio").value.trim();
    if (!name) { toast("צריך להוסיף שם"); return; }
    window.addingFamilyMember = true;
    try {
      const form = new FormData(); form.set("name", name); form.set("bio", bio);
      const file = document.getElementById("userPhoto").files[0];
      if (file) {
        const compressed = await compressImageFile(file, 500, 0.72);
        form.set("photo", dataUrlToBlob(compressed), "profile.jpg");
      }
      await request("/api/family", { method: "POST", body: form });
      await refreshShared(); closeUserModal();
      ["userName", "userBio", "userPhoto"].forEach((field) => { document.getElementById(field).value = ""; });
      toast("בן המשפחה נוסף ויופיע אצל כולם");
    } catch (error) { toast(messageFor(error)); }
    finally { window.addingFamilyMember = false; }
  };

  window.submitRecipe = async () => {
    if (window.recipeSaving) return;
    const name = document.getElementById("recipeName")?.value.trim();
    if (!name) { toast("צריך להוסיף שם למתכון"); return; }
    const author = chosenAuthor("recipeAuthor");
    if (!author) { toast("צריך לבחור או לכתוב את השם של מי שהוסיף/ה את המתכון"); return; }
    const recipe = {
      name, author, origin: document.getElementById("recipeOrigin")?.value.trim() || "",
      dedication: document.getElementById("recipeDedication")?.value.trim() || "",
      dietaryTag: document.getElementById("recipeDietaryTag")?.value || "לא צוין",
      category: document.getElementById("recipeCategory")?.value || "ארוחות ערב",
      difficulty: document.getElementById("recipeDifficulty")?.value || "קל",
      time: document.getElementById("recipeTime")?.value ? `${document.getElementById("recipeTime").value} דקות` : "",
      servings: document.getElementById("recipeServings")?.value || "",
      glutenFree: document.getElementById("recipeGlutenFree")?.checked || false,
    };
    const textareas = document.querySelectorAll("#modal textarea");
    [recipe.story, recipe.ingredients, recipe.steps] = [...textareas].map((area) => area.value || "");
    const files = [...(document.getElementById("recipeImage")?.files || [])];
    const videoFile = document.getElementById("recipeVideo")?.files?.[0];
    if (files.length > 5) { toast("אפשר להעלות עד 5 תמונות"); return; }
    window.recipeSaving = true;
    const button = document.querySelector('#modal button[onclick="submitRecipe()"]');
    if (button) { button.disabled = true; button.textContent = "שומר מתכון…"; }
    try {
      const form = new FormData(); form.set("recipe", JSON.stringify(recipe));
      if (videoFile) { await validateVideoFile(videoFile); form.set("video", videoFile, videoFile.name); }
      for (const file of files) {
        const compressed = await compressImageFile(file, 1200, 0.72);
        form.append("images", dataUrlToBlob(compressed), "recipe.jpg");
      }
      await request("/api/recipes", { method: "POST", body: form });
      await refreshShared(); closeModal(); toast("המתכון, התמונות והסרטון נשמרו ויופיעו אצל כולם");
    } catch (error) { console.error(error); toast(error.message === "VIDEO_DURATION" ? "הסרטון ארוך מדי — המגבלה היא 30 שניות" : error.message === "VIDEO_SIZE" ? "הסרטון גדול מדי — המגבלה היא 5MB" : messageFor(error)); }
    finally { window.recipeSaving = false; if (button) { button.disabled = false; button.textContent = "שמירת המתכון"; } }
  };

  window.saveEditedRecipe = async () => {
    const index = window.editingRecipeIndex;
    const current = shared.recipes[index];
    if (!current) return;
    const value = (field) => document.getElementById(field)?.value ?? "";
    const recipe = {
      name: value("editRecipeName").trim(), author: chosenAuthor("editRecipeAuthor"), origin: value("editRecipeOrigin").trim(),
      dedication: value("editRecipeDedication").trim(), dietaryTag: value("editRecipeDietaryTag") || "לא צוין",
      category: value("editRecipeCategory"), difficulty: value("editRecipeDifficulty"),
      time: value("editRecipeTime").trim() ? `${value("editRecipeTime").trim()} דקות` : "",
      servings: value("editRecipeServings"), story: value("editRecipeStory"),
      ingredients: value("editRecipeIngredients"), steps: value("editRecipeSteps"),
      glutenFree: document.getElementById("editRecipeGlutenFree")?.checked || false,
    };
    if (!recipe.name) { toast("צריך להוסיף שם למתכון"); return; }
    if (!recipe.author) { toast("צריך לבחור או לכתוב את השם של מי שהוסיף/ה את המתכון"); return; }
    const videoFile = document.getElementById("editRecipeVideo")?.files?.[0];
    try {
      if (videoFile) await validateVideoFile(videoFile);
      await request(`/api/recipes/${id(current.id)}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(recipe) });
      if (videoFile) { const videoForm = new FormData(); videoForm.set("video", videoFile, videoFile.name); await request(`/api/recipes/${id(current.id)}/video`, { method: "PUT", body: videoForm }); }
      await refreshShared(); closeEditRecipe(); toast("המתכון עודכן אצל כולם");
    } catch (error) { toast(error.message === "VIDEO_DURATION" ? "הסרטון ארוך מדי — המגבלה היא 30 שניות" : error.message === "VIDEO_SIZE" ? "הסרטון גדול מדי — המגבלה היא 5MB" : messageFor(error)); }
  };

  window.saveEditedImages = async () => {
    const index = editingRecipeIndex;
    const current = shared.recipes[index];
    if (!current) return;
    const form = new FormData();
    form.set("keep", JSON.stringify(editImagesBuffer.filter((source) => source.startsWith("/media/"))));
    for (const source of editImagesBuffer.filter((item) => item.startsWith("data:"))) form.append("images", dataUrlToBlob(source), "recipe.jpg");
    try {
      await request(`/api/recipes/${id(current.id)}/images`, { method: "PUT", body: form });
      closeEditImages(); await refreshShared(); toast("התמונות עודכנו אצל כולם");
    } catch (error) { toast(messageFor(error)); }
  };

  async function deleteRecipeAt(index) {
    const recipe = shared.recipes[index];
    if (!recipe) return;
    if (!confirm(`למחוק את המתכון „${recipe.name}”? אי אפשר לבטל את המחיקה.`)) return;
    try {
      await request(`/api/recipes/${id(recipe.id)}`, { method: "DELETE" });
      const favorites = getFavorites().filter((favoriteId) => favoriteId !== recipe.id);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
      document.getElementById("recipeModal")?.classList.remove("open");
      window.currentRecipeIndex = null;
      await refreshShared();
      toast("המתכון נמחק מהאתר");
    } catch (error) { toast(messageFor(error)); }
  }

  window.deleteRecipeFromCard = deleteRecipeAt;
  window.deleteCurrentRecipe = () => deleteRecipeAt(window.currentRecipeIndex);

  window.submitFeedback = async () => {
    if (window.feedbackSaving) return;
    const name = document.getElementById("feedbackName")?.value.trim() || "";
    const type = document.getElementById("feedbackType")?.value || "משוב";
    const message = document.getElementById("feedbackMessage")?.value.trim() || "";
    if (!message) { toast("צריך לכתוב תוכן לפנייה"); return; }
    const button = document.getElementById("feedbackSubmit");
    window.feedbackSaving = true;
    if (button) { button.disabled = true; button.textContent = "שולח…"; }
    try {
      await request("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, type, message }) });
      document.getElementById("feedbackName").value = "";
      document.getElementById("feedbackMessage").value = "";
      toast("תודה! הפנייה נשמרה ונשלחה לתיבות ההודעות של מנהלי הספר.");
    } catch (error) { toast(messageFor(error)); }
    finally { window.feedbackSaving = false; if (button) { button.disabled = false; button.textContent = "שליחת הפנייה"; } }
  };

  const addEnhancementStyles = () => {
    const style = document.createElement("style");
    style.textContent = `.eventBoard{display:grid;grid-template-columns:1fr minmax(190px,260px);gap:10px 22px;align-items:center;margin:24px 0;padding:20px 24px;background:#fbf1eb;border:1px solid var(--line);border-radius:22px}.eventBoard h2{margin:0 0 6px}.eventBoard p{margin:0;color:var(--muted)}.eventRecipeLinks{grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap}.eventRecipeLinks button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:9px 14px;color:var(--ink);cursor:pointer}.recipeOrigin{margin:6px 0 14px;padding:7px 12px;background:#f7eee8;border-radius:999px;width:max-content;color:var(--accent);font-weight:700}.recipeOriginCard{margin:-7px 0 12px;color:var(--accent);font-size:13px;font-weight:700}.recipeComments{margin-top:20px;padding:18px;background:#fbf6f2;border-radius:18px}.recipeComments h3{margin-top:0}.commentForm{display:grid;gap:10px;margin-top:16px}.commentItem{padding:12px 0;border-bottom:1px solid var(--line)}.commentItem small{color:var(--muted)}.familyNearLimit{color:#a74320!important;font-weight:700}.cookingMode #recipeModal .modalBox{font-size:1.3rem}.cookingMode #recipeModal .fullRecipeContent,.cookingMode #recipeModal #recipeIngredients,.cookingMode #recipeModal #recipeSteps{font-size:1.3rem;line-height:1.8}.cookingExit{position:fixed;right:16px;bottom:16px;z-index:9999}#recipePrintArea{display:none}@media print{body>*{visibility:hidden!important}#recipePrintArea,#recipePrintArea *{visibility:visible!important}#recipePrintArea{display:block!important;position:absolute;inset:0 auto auto 0;width:100%;padding:20px;color:#111;background:#fff;font:12pt/1.55 Arial,sans-serif;direction:rtl}#recipePrintArea h1{font-size:22pt}#recipePrintArea h2{font-size:15pt;margin-bottom:4px}#recipePrintArea .printCols{display:grid;grid-template-columns:1fr 1fr;gap:24px}#recipePrintArea .printOrigin{color:#555}}@media(max-width:700px){.eventBoard{grid-template-columns:1fr;padding:16px}.eventRecipeLinks{grid-column:auto}}`;
    document.head.appendChild(style);
  };

  const eventTerms = {
    shabbat: ["חלה", "שבת", "דג", "חמין", "סלט", "קוגל"],
    rosh: ["דבש", "תפוח", "רימון", "ראש השנה", "עוגת דבש"],
    hanukkah: ["סופגנ", "לביב", "חנוכה"],
    passover: ["מצה", "פסח", "כשר לפסח", "קניידלעך"],
    birthday: ["עוגה", "עוגיות", "קינוח", "שוקולד"]
  };
  function renderEventRecipes() {
    const box = document.getElementById("eventRecipeLinks"), picker = document.getElementById("eventPicker");
    if (!box || !picker) return;
    const terms = eventTerms[picker.value] || [];
    const all = window.getRecipes?.() || [];
    const selected = all.map((r, i) => ({ r, i })).filter(({ r }) => {
      const source = [r.name, r.category, r.ingredients, r.story].map(x => Array.isArray(x) ? x.join(" ") : String(x || "")).join(" ").toLowerCase();
      return terms.some(term => source.includes(term));
    });
    box.replaceChildren();
    if (!selected.length) { const note = document.createElement("span"); note.textContent = "עוד לא מצאנו מתכון שסומן לאירוע הזה — אפשר לחפש בספר לפי שם או מצרך."; box.appendChild(note); return; }
    selected.forEach(({ r }) => { const button = document.createElement("button"); button.type = "button"; button.textContent = `🍽️ ${r.name}`; button.onclick = () => { const i = (window.getRecipes?.() || []).findIndex(x => x.id === r.id); if (i >= 0) window.openSavedRecipe?.(i); }; box.appendChild(button); });
  }
  document.getElementById("eventPicker")?.addEventListener("change", renderEventRecipes);

  const node = (tag, cls, value) => { const el = document.createElement(tag); if (cls) el.className = cls; if (value != null) el.textContent = value; return el; };
  function ensureFeatureSuite() {
    let host = document.getElementById("familyFeatureSuite"); if (host) return host;
    const hero = document.querySelector("#home .hero"); if (!hero) return null;
    host = node("section", "familyFeatureSuite"); host.id = "familyFeatureSuite";
    host.innerHTML = `<div class="featureHeading"><div><span class="featureEyebrow">עוד דברים שכיף לעשות יחד</span><h2>הספר המשפחתי מתרחב</h2><p>תכננו ארוחה, גלו כלים שימושיים ומצאו מה חדש בספר.</p></div><div class="featureTabs" role="tablist"><button data-feature="weekly" class="active">⭐ מתכון השבוע</button><button data-feature="kitchen">🧁 כלי מטבח</button><button data-feature="planning">🗓️ תכנון משפחתי</button><button data-feature="menus">🍽️ תפריטי שבת וחג</button><button data-feature="fridge">🥕 מה יש במקרר?</button><button data-feature="grocery">🧺 רשימת קניות</button><button data-feature="gallery">📷 גלריית תמונות</button><button data-feature="stories">📖 סיפורי משפחה</button><button data-feature="updates">🔔 עדכונים</button><button data-feature="export">📕 הדפסת הספר</button></div></div><div class="featurePanel" id="featurePanel"></div>`;
    hero.insertAdjacentElement("afterend", host);
    host.querySelectorAll("[data-feature]").forEach(btn => btn.onclick = () => { host.querySelectorAll("[data-feature]").forEach(b => b.classList.toggle("active", b === btn)); renderFeaturePanel(btn.dataset.feature); });
    const surprise=node("button","btn primary surpriseRecipe","🎲 הפתיעו אותי עם מתכון");surprise.onclick=()=>{if(!shared.recipes.length)return toast("עוד לא נוספו מתכונים לספר");const recipe=shared.recipes[Math.floor(Math.random()*shared.recipes.length)];window.openSavedRecipe?.(shared.recipes.findIndex(r=>r.id===recipe.id))};host.querySelector(".featureHeading")?.appendChild(surprise);
    return host;
  }
  const weekIndex = () => { const now = new Date(), start = new Date(now.getFullYear(),0,1); return now.getFullYear()*54 + Math.floor(((now-start)/86400000 + start.getDay())/7); };
  function renderFeatureSuite() {
    const host = ensureFeatureSuite(); if (!host) return;
    const latest = shared.recipes.map(r => r.createdAt || "").sort().at(-1) || "";
    if (latest && !localStorage.getItem("familyCookbookLastSeenRecipe")) localStorage.setItem("familyCookbookLastSeenRecipe", latest);
    renderFeaturePanel(host.querySelector("[data-feature].active")?.dataset.feature || "weekly");
  }
  function renderFeaturePanel(which) {
    const panel = document.getElementById("featurePanel"); if (!panel) return; panel.replaceChildren();
    if (which === "weekly") {
      const card = node("div", "featuredRecipe"), recipes = shared.recipes;
      if (!recipes.length) { card.append(node("h3", "", "מתכון השבוע"), node("p", "", "הוסיפו מתכון ראשון כדי שיופיע כאן.")); panel.appendChild(card); return; }
      const recipe = recipes[weekIndex() % recipes.length]; if (recipe.images?.[0]) { const img = node("img"); img.src = recipe.images[0]; img.alt = `תמונה של ${recipe.name}`; card.appendChild(img); }
      const copy = node("div", "featuredCopy"); copy.append(node("span", "featureEyebrow", "נבחר מתוך ספר המתכונים"), node("h3", "", recipe.name), node("p", "", [recipe.category, recipe.time, `מאת ${recipe.author || "המשפחה"}`].filter(Boolean).join(" · ")));
      const open = node("button", "btn primary", "לפתיחת המתכון ←"); open.onclick = () => { const i = recipes.findIndex(r => r.id === recipe.id); if (i >= 0) window.openSavedRecipe?.(i); }; copy.appendChild(open); card.appendChild(copy); panel.append(card, node("small", "featureHint", "המתכון מתחלף אוטומטית מדי שבוע.")); return;
    }
    if (which === "kitchen") return renderKitchenTools(panel);
    if (which === "planning") return renderFamilyPlanning(panel);
    if (which === "menus") return renderMenus(panel);
    if (which === "fridge") return renderFridge(panel);
    if (which === "grocery") return renderGrocery(panel);
    if (which === "gallery") return renderGallery(panel);
    if (which === "stories") return renderStories(panel);
    if (which === "updates") return renderUpdates(panel);
    if (which === "export") { panel.append(node("h3", "", "ספר המתכונים המשפחתי להדפסה"), node("p", "", `נמצאו ${shared.recipes.length} מתכונים. ההדפסה כוללת מצרכים, הוראות, קרדיט ותמונות ראשיות.`)); const b = node("button", "btn primary", "📕 הדפסת הספר / שמירה כ‑PDF"); b.onclick = window.printFamilyCookbook; panel.appendChild(b); }
  }
  function renderMenus(panel) {
    panel.append(node("h3", "", "מתכננים ארוחה שלמה"), node("p", "", "בחרו כמה מתכונים ושמרו תפריט ורשימת קניות משותפת."));
    const form = node("div", "menuBuilder"), occasion = document.createElement("select"), title = document.createElement("input");
    ["ארוחת שבת", "ארוחת חג", "יום הולדת", "תפריט אישי"].forEach((value,i)=>occasion.append(new Option(value,String(i)))); occasion.setAttribute("aria-label","לאיזה אירוע התפריט?");
    title.placeholder = "שם התפריט, למשל: ארוחת שישי אצל סבתא"; title.setAttribute("aria-label", "שם התפריט"); form.append(occasion,title);
    const choices = node("div", "menuChoices"); shared.recipes.forEach(recipe => { const label = node("label", "menuChoice"), check = document.createElement("input"); check.type = "checkbox"; check.value = recipe.id; label.append(check, node("span", "", recipe.name)); choices.appendChild(label); }); form.appendChild(choices);
    const save = node("button", "btn primary", "שמירת התפריט ורשימת הקניות"); save.onclick = async () => { const recipeIds = [...choices.querySelectorAll("input:checked")].map(x => x.value); const menuTitle=title.value.trim()||occasion.options[occasion.selectedIndex].text; if (!recipeIds.length) return toast("בחרו לפחות מתכון אחד לתפריט"); try { await request("/api/menus", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({title:menuTitle,recipeIds}) }); const data=await request("/api/data"); shared.menus=data.menus||[]; renderFeaturePanel("menus"); toast("התפריט ורשימת הקניות נשמרו לכולם"); } catch(e) { toast(messageFor(e)); } }; form.appendChild(save); panel.appendChild(form);
    if (!shared.menus.length) return;
    panel.append(node("h3", "featureSubhead", "התפריטים שנשמרו")); const saved = node("div", "savedMenus");
    shared.menus.forEach(menu => { const row=node("article","savedMenu"), open=node("button","btn ghost","🛒 הצגת רשימת קניות"), share=node("button","btn ghost","💬 שיתוף בוואטסאפ"), remove=node("button","textButton","מחיקה"); row.append(node("h4","",menu.title),open,share,remove); open.onclick=()=>shoppingList(menu,panel); share.onclick=()=>{const recipes=(menu.recipeIds||[]).map(key=>shared.recipes.find(r=>r.id===key)).filter(Boolean);const content=[`תפריט משפחתי: ${menu.title}`, ...recipes.map(r=>`• ${r.name}`),"רשימת קניות:",...recipes.flatMap(r=>String(r.ingredients||"").split(/\n+/).filter(Boolean))].join("\n");window.open(`https://wa.me/?text=${encodeURIComponent(content)}`,"_blank","noopener,noreferrer")}; remove.onclick=async()=>{if(!confirm(`למחוק את התפריט „${menu.title}”?`))return;try{await request(`/api/menus/${id(menu.id)}`,{method:"DELETE"});shared.menus=shared.menus.filter(m=>m.id!==menu.id);renderFeaturePanel("menus")}catch{toast("לא הצלחנו למחוק את התפריט")}}; saved.appendChild(row); }); panel.appendChild(saved);
  }
  function renderKitchenTools(panel) {
    panel.append(node("h3","","🧁 כלים קטנים שעוזרים במטבח"),node("p","featureHint","המרות נפח ומשקל הן הערכות: צפיפות המצרכים משתנה לפי סוג ואופן המדידה."));
    const converter=node("section","kitchenToolCard"),amount=document.createElement("input"),ingredient=document.createElement("select"),from=document.createElement("select"),to=document.createElement("select"),result=node("output","kitchenResult","—");
    amount.type="number";amount.min="0";amount.step="any";amount.value="1";amount.setAttribute("aria-label","כמות להמרה");
    [["קמח לבן",120], ["סוכר",200], ["סוכר חום",180], ["חמאה",227], ["מים / חלב",240], ["שמן",220], ["קקאו",100]].forEach(([label,g])=>ingredient.append(new Option(label,String(g))));
    [["כוס","cup"],["כף","tbsp"],["כפית","tsp"],["מ״ל","ml"],["גרם","g"]].forEach(([label,value])=>{from.append(new Option(label,value));to.append(new Option(label,value))});from.value="cup";to.value="g";
    const convert=()=>{const value=Number(amount.value)||0,density=Number(ingredient.value),mlPerUnit={cup:240,tbsp:15,tsp:5,ml:1};let milliliters=from.value==="g"?value/density*240:value*mlPerUnit[from.value],output=to.value==="g"?milliliters*density/240:milliliters/mlPerUnit[to.value];if(from.value==="g"&&to.value==="g")output=value;result.textContent=`≈ ${Number(output.toFixed(1))} ${to.options[to.selectedIndex].text}`};[amount,ingredient,from,to].forEach(el=>el.oninput=convert);converter.append(node("strong","","כוסות, כפות, כפיות, מ״ל וגרמים"),amount,ingredient,from,node("span","","→"),to,result);panel.appendChild(converter);convert();
    const temp=node("section","kitchenToolCard");temp.append(node("strong","","🌡️ צלזיוס ↔ פרנהייט"));const c=document.createElement("input"),f=document.createElement("input");c.type=f.type="number";c.placeholder="°C";f.placeholder="°F";c.setAttribute("aria-label","טמפרטורה בצלזיוס");f.setAttribute("aria-label","טמפרטורה בפרנהייט");c.oninput=()=>{f.value=c.value===""?"":String(Math.round(Number(c.value)*9/5+32))};f.oninput=()=>{c.value=f.value===""?"":String(Math.round((Number(f.value)-32)*5/9))};temp.append(c,f);panel.appendChild(temp);
    const swaps=[["שמנת חמוצה","יוגורט יווני סמיך (טעם מעט שונה)"],["חמאה","מרגרינה באותה כמות ברוב המאפים"],["ביצה באפייה","¼ כוס רסק תפוחים או בננה מעוכה; עשוי לשנות מרקם"],["שמרים טריים","שמרים יבשים: כשליש מהכמות (בדקו הוראות אריזה)"],["חלב","משקה סויה/שיבולת שועל לא ממותק"],["אבקת אפייה","לכל כפית: ¼ כפית סודה לשתייה + ½ כפית קרם טרטר"]];
    panel.append(node("h3","featureSubhead","🔁 אין את המצרך? רעיונות לתחליפים"));const table=node("div","substituteGrid");swaps.forEach(([a,b])=>{const row=node("article","substituteCard");row.append(node("strong","",`במקום ${a}`),node("span","",b));table.appendChild(row)});panel.appendChild(table);panel.append(node("small","featureHint","תחליפים עשויים לשנות מרקם וטעם. בדקו גם אלרגיות והוראות שעל האריזה."));
    panel.append(node("h3","featureSubhead","⏲️ מדריך זמני בישול בסיסיים"));const times=[["ביצה קשה","9–12 דקות מרגע הרתיחה"],["ביצה רכה","5–7 דקות מרגע הרתיחה"],["אורז לבן","15–18 דקות, ואז מנוחה מכוסה"],["קינואה","12–15 דקות, ואז מנוחה קצרה"],["תפוחי אדמה בקוביות","10–15 דקות, עד שמזלג נכנס בקלות"]],timeGrid=node("div","substituteGrid");times.forEach(([a,b])=>{const item=node("article","substituteCard");item.append(node("strong","",a),node("span","",b));timeGrid.appendChild(item)});panel.appendChild(timeGrid);
  }
  function renderFamilyPlanning(panel) {
    panel.append(node("h3","","🗓️ תכנון הארוחות של המשפחה"),node("p","featureHint","בחרו יום מהיום ועד שלושה שבועות קדימה. ימים שעברו אינם מוצגים."));
    const start=new Date();start.setHours(0,0,0,0);const dayKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    const dates=Array.from({length:21},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return {key:dayKey(d),date:d}}),lastDay=dates.at(-1).key;
    let selectedDay=dates[0].key;const picker=node("div","plannerCalendar"),selectedLabel=node("p","plannerSelected");
    const eventTitle=document.createElement("input"),eventType=document.createElement("select"),eventSave=node("button","btn primary","הוספת אירוע לתכנון");
    eventType.setAttribute("aria-label","סוג המפגש המשפחתי");eventType.append(new Option("בחרו סוג מפגש…",""));["ארוחה משפחתית","ארוחת שישי / שבת","ארוחת חג","יום הולדת","מפגש משפחתי","פיקניק משפחתי","אירוע אחר"].forEach(value=>eventType.append(new Option(value,value)));eventType.onchange=()=>{eventTitle.value=eventType.value==="אירוע אחר"?"":eventType.value};eventTitle.placeholder="שם האירוע (אפשר לשנות את ההצעה)";
    const updateSelection=()=>{selectedLabel.textContent=`התאריך שנבחר: ${new Date(`${selectedDay}T12:00:00`).toLocaleDateString("he-IL",{weekday:"long",day:"numeric",month:"long"})}`;picker.querySelectorAll("button").forEach(button=>button.classList.toggle("selected",button.dataset.day===selectedDay))};
    dates.forEach(({key,date})=>{const events=(shared.events||[]).filter(item=>item.eventDate===key),button=node("button","plannerDate");button.type="button";button.dataset.day=key;button.setAttribute("aria-label",`בחירת ${date.toLocaleDateString("he-IL")}`);button.append(node("span","plannerWeekday",date.toLocaleDateString("he-IL",{weekday:"short"})),node("strong","",String(date.getDate())));if(events.length)button.append(node("span","plannerDot",String(events.length)));button.onclick=()=>{selectedDay=key;updateSelection()};picker.appendChild(button)});
    panel.appendChild(picker);updateSelection();
    const eventForm=node("div","plannerForm compactPlannerForm");eventForm.append(eventType,eventTitle,eventSave);panel.append(eventForm,selectedLabel,node("small","featureHint",`אפשר לבחור תאריך עד ${new Date(`${lastDay}T12:00:00`).toLocaleDateString("he-IL",{day:"numeric",month:"long"})}.`));eventSave.onclick=async()=>{if(!eventTitle.value.trim())return toast("מלאו שם לאירוע");try{await request("/api/events",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({title:eventTitle.value.trim(),eventDate:selectedDay,recipeId:null})});await refreshShared();renderFeaturePanel("planning")}catch(e){toast(messageFor(e))}};
    panel.append(node("h3","featureSubhead","🗳️ מה מבשלים השבת?"));const poll=shared.poll;
    if(poll){panel.append(node("p","",poll.title));const pollList=node("div","pollOptions");poll.options.forEach(option=>{const count=Object.values(poll.votes||{}).filter(x=>x===option).length,button=node("button","btn ghost",`${option} · ${count} הצבעות`);button.onclick=async()=>{const member=prompt("מה השם שלכם במשפחה?");if(!shared.family.some(m=>m.name===member))return toast("בחרו שם משפחתי שמופיע באתר");try{await request(`/api/polls/${poll.id}/vote`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({member,option})});await refreshShared();renderFeaturePanel("planning")}catch(e){toast(messageFor(e))}};pollList.appendChild(button)});panel.appendChild(pollList)}
    const pollForm=node("div","plannerForm"),question=document.createElement("input"),options=document.createElement("input"),makePoll=node("button","btn primary",poll?"יצירת סקר חדש":"פתיחת סקר לשבת");question.placeholder="שאלת הסקר, למשל: מה נכין לשבת?";options.placeholder="אפשרויות, מופרדות בפסיקים";makePoll.onclick=async()=>{const opts=options.value.split(",").map(s=>s.trim()).filter(Boolean);if(!question.value.trim()||opts.length<2)return toast("כתבו שאלה ולפחות שתי אפשרויות");try{await request("/api/polls",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({title:question.value,options:opts})});await refreshShared();renderFeaturePanel("planning")}catch(e){toast(messageFor(e))}};pollForm.append(question,options,makePoll);panel.appendChild(pollForm);
    panel.append(node("h3","featureSubhead","🎂 אירועים קרובים"));const events=node("div","eventList");(shared.events||[]).filter(item=>item.eventDate>=dates[0].key&&item.eventDate<=lastDay).forEach(item=>{const row=node("article","eventCard"),recipe=shared.recipes.find(r=>r.id===item.recipeId),del=node("button","textButton","מחיקה");row.append(node("strong","",item.title),node("span","",new Date(`${item.eventDate}T12:00:00`).toLocaleDateString("he-IL")));if(recipe){const open=node("button","textButton",`המתכון האהוב: ${recipe.name}`);open.onclick=()=>window.openSavedRecipe?.(shared.recipes.findIndex(r=>r.id===recipe.id));row.appendChild(open)}del.onclick=async()=>{await request(`/api/events/${item.id}`,{method:"DELETE"});await refreshShared();renderFeaturePanel("planning")};row.appendChild(del);events.appendChild(row)});panel.appendChild(events);
  }
  function shoppingList(menu,panel) { let list=panel.querySelector(".shoppingList"); if(!list){list=node("section","shoppingList");panel.appendChild(list)} list.replaceChildren(node("h3","",`🛒 רשימת קניות — ${menu.title}`)); const selected=(menu.recipeIds||[]).map(key=>shared.recipes.find(r=>r.id===key)).filter(Boolean), counts=new Map(); selected.forEach(r=>String(r.ingredients||"").split(/\n+/).map(x=>x.trim()).filter(Boolean).forEach(line=>counts.set(line,(counts.get(line)||0)+1)));const combined=node("div","combinedShopping"),all=node("ul");counts.forEach((n,line)=>all.appendChild(node("li","",n>1?`${line} — מופיע ב־${n} מתכונים`:line)));combined.append(node("h4","","רשימה מאוחדת"),all);list.appendChild(combined);selected.forEach(r=>{const section=node("div","shoppingRecipe"),ul=node("ul");String(r.ingredients||"").split(/\n+/).map(x=>x.trim()).filter(Boolean).forEach(line=>ul.appendChild(node("li","",line)));section.append(node("h4","",r.name),ul);list.appendChild(section)}); }
  function renderGallery(panel) { panel.append(node("h3","","כל התמונות של המנות"),node("p","","התמונות שצורפו למתכונים נאספות כאן."));const grid=node("div","familyPhotoGallery");let count=0;shared.recipes.forEach(recipe=>(recipe.images||(recipe.image?[recipe.image]:[])).forEach((src,n)=>{if(!src)return;count++;const b=node("button","galleryTile"),img=node("img");img.src=src;img.alt=`${recipe.name}, תמונה ${n+1}`;b.append(img,node("span","",recipe.name));b.onclick=()=>{const i=shared.recipes.findIndex(r=>r.id===recipe.id);if(i>=0)window.openSavedRecipe?.(i)};grid.appendChild(b)}));if(!count)grid.append(node("p","","עדיין אין תמונות. הוסיפו תמונה למתכון כדי לבנות את הגלריה."));panel.appendChild(grid); }
  function renderStories(panel) { panel.append(node("h3","","זיכרונות וסיפורי משפחה"),node("p","","שמרו כאן אנקדוטות, תמונות ישנות וזיכרונות שאינם קשורים למתכון."));const form=node("form","storyForm"),who=document.createElement("select"),title=document.createElement("input"),body=document.createElement("textarea"),photo=document.createElement("input"),send=node("button","btn primary","שמירת הסיפור המשפחתי");who.required=true;who.append(new Option("מי משתף את הסיפור?",""));shared.family.forEach(m=>who.append(new Option(m.name,m.name)));title.required=true;title.maxLength=120;title.placeholder="כותרת לזיכרון";body.required=true;body.maxLength=3000;body.placeholder="ספרו את הסיפור…";photo.type="file";photo.accept="image/jpeg,image/png,image/webp,image/gif";photo.setAttribute("aria-label","תמונה לסיפור, אפשרי");send.type="submit";form.append(who,title,body,photo,send);form.onsubmit=async e=>{e.preventDefault();const data=new FormData();data.set("author",who.value);data.set("title",title.value);data.set("body",body.value);if(photo.files[0])data.set("image",photo.files[0]);try{await request("/api/stories",{method:"POST",body:data});const fresh=await request("/api/data");shared.stories=fresh.stories||[];renderFeaturePanel("stories");toast("הסיפור נשמר לכל המשפחה")}catch(error){toast(messageFor(error))}};panel.appendChild(form);const grid=node("div","storyGrid");shared.stories.forEach(s=>{const card=node("article","storyCard");if(s.image){const img=node("img");img.src=s.image;img.alt=`תמונה לסיפור ${s.title}`;card.appendChild(img)}card.append(node("h4","",s.title),node("p","",s.body),node("small","",`סיפר/ה ${s.author} · ${new Date(s.createdAt).toLocaleDateString("he-IL")}`));grid.appendChild(card)});if(shared.stories.length)panel.appendChild(grid);else panel.append(node("p","featureHint","עוד לא נשמרו סיפורים. מוזמנים לשמור את הראשון.")); }
  function renderUpdates(panel) { const seen=localStorage.getItem("familyCookbookLastSeenRecipe")||"", fresh=shared.recipes.filter(r=>r.createdAt&&r.createdAt>seen).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));panel.append(node("h3","",fresh.length?`🔔 ${fresh.length} מתכונים חדשים מאז הביקור האחרון`:"🔔 עדכוני ספר המתכונים"),node("p","","האתר בודק אם נוספו מתכונים חדשים ומציג אותם כאן."));const list=node("div","updateList");[...shared.recipes].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,8).forEach(recipe=>{const b=node("button","updateRecipe",`${fresh.includes(recipe)?"🆕":"🍲"} ${recipe.name} · ${recipe.author||"המשפחה"}`);b.onclick=()=>{const i=shared.recipes.findIndex(r=>r.id===recipe.id);if(i>=0)window.openSavedRecipe?.(i)};list.appendChild(b)});panel.appendChild(list);const mark=node("button","btn ghost","סימון העדכונים כנקראו");mark.onclick=()=>{localStorage.setItem("familyCookbookLastSeenRecipe",shared.recipes.map(r=>r.createdAt||"").sort().at(-1)||new Date().toISOString());renderFeaturePanel("updates")};panel.appendChild(mark); }
  const SHOPPING_KEY="familyCookbookShoppingIds";
  function shoppingIds(){try{return JSON.parse(localStorage.getItem(SHOPPING_KEY)||"[]")}catch{return []}}
  function addToShoppingList(recipe){const values=new Set(shoppingIds());values.add(recipe.id);localStorage.setItem(SHOPPING_KEY,JSON.stringify([...values]));toast("המתכון נוסף לרשימת הקניות במכשיר הזה");}
  function renderGrocery(panel){const ids=shoppingIds(),recipes=ids.map(key=>shared.recipes.find(r=>r.id===key)).filter(Boolean);panel.append(node("h3","","🧺 רשימת הקניות שלי"),node("p","","המצרכים מהמתכונים שבחרתם, מסודרים ברשימה אחת. הרשימה נשמרת במכשיר הזה."));if(!recipes.length){panel.append(node("p","featureHint","הרשימה ריקה. פתחו מתכון ולחצו „הוספה לרשימת הקניות”."));return}const counts=new Map();recipes.forEach(r=>String(r.ingredients||"").split(/\n+/).map(x=>x.trim()).filter(Boolean).forEach(line=>counts.set(line,(counts.get(line)||0)+1)));const ul=node("ul","groceryCombined");counts.forEach((amount,line)=>{const li=node("li","",amount>1?`${line} · מופיע ב־${amount} מתכונים`:line);ul.appendChild(li)});panel.appendChild(ul);const selected=node("div","savedMenus");recipes.forEach(r=>{const row=node("div","savedMenu"),remove=node("button","textButton","הסרה");row.append(node("strong","",r.name),remove);remove.onclick=()=>{localStorage.setItem(SHOPPING_KEY,JSON.stringify(shoppingIds().filter(key=>key!==r.id)));renderFeaturePanel("grocery")};selected.appendChild(row)});panel.append(selected);const buttons=node("div","featureButtonRow"),share=node("button","btn primary","💬 שליחת הרשימה בוואטסאפ"),clear=node("button","btn ghost","ניקוי הרשימה");share.onclick=()=>{const text=["רשימת קניות משפחתית",...counts.keys()].join("\n☐ ");window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,"_blank","noopener,noreferrer")};clear.onclick=()=>{localStorage.removeItem(SHOPPING_KEY);renderFeaturePanel("grocery")};buttons.append(share,clear);panel.appendChild(buttons)}
  function renderFridge(panel) {
    panel.append(node("h3", "", "🥕 מה יש במקרר?"), node("p", "featureHint", "הוסיפו מצרכים אחד אחד וקבלו מתכונים מתאימים, כולל רשימה מדויקת של מה שחסר."));
    const entry = node("div", "fridgeEntry"), input = document.createElement("input"), add = node("button", "btn primary", "הוספה לרשימה");
    input.type = "text"; input.placeholder = "כתבו מצרך, למשל ביצים"; input.setAttribute("aria-label", "הקלידו מצרך שיש בבית");
    add.type = "button"; entry.append(input, add);
    const selected = node("div", "fridgeSelected"), suggestions = node("div", "fridgeSuggestions"), clear = node("button", "textButton", "ניקוי הרשימה");
    const filtersWrap = document.createElement("details"); filtersWrap.className = "fridgeFilterDetails";
    const summaryTitle = node("summary", "", "מסננים נוספים"); filtersWrap.appendChild(summaryTitle);
    const filters = node("div", "fridgeFilters"), diet = document.createElement("select"), time = document.createElement("select"), difficulty = document.createElement("select");
    [[diet, ["כל הסוגים", "טבעוני", "צמחוני", "פרווה", "חלבי", "בשרי"]], [time, ["כל זמני ההכנה", "עד 15 דקות", "עד שעה", "מעל שעה"]], [difficulty, ["כל הרמות", "קל", "בינוני", "מאתגר"]]].forEach(([select, labels]) => {
      labels.forEach((label, index) => select.append(new Option(label, index ? label : "")));
      select.setAttribute("aria-label", labels[0]); select.onchange = run;
    });
    filters.append(diet, time, difficulty); filtersWrap.appendChild(filters);
    const summary = node("p", "fridgeSummary", ""); const results = node("div", "fridgeResults");
    let available = [];
    const normalize = value => String(value || "").normalize("NFC").toLocaleLowerCase("he-IL")
      .replace(/[\u0591-\u05C7\u200e\u200f]/g, "")
      .replace(/[0-9¼½¾⅓⅔⅛⅜⅝⅞]+(?:[.,/][0-9]+)?/g, " ")
      .replace(/(?:כוסות?|כפות?|כף|כפיות?|כפית|גרמים?|גרם|קילו|ק״ג|קג|מ״ל|מל|ליטר|חבילות?|יחידות?|שקיות?|קורט|חופן|כפיות|כף|של|גדולה|גדול|בינונית|בינוני|קטנה|קטן|קצוץ|קצוצה|טחונה|טחון|טרייה|טרי|לפי הטעם)/g, " ")
      .replace(/תפוחי אדמה/g, "תפוח אדמה").replace(/ביצים/g, "ביצה").replace(/עגבניות/g, "עגבניה")
      .replace(/[()[\],.;:]/g, " ").replace(/\s+/g, " ").trim();
    const sameIngredient = (need, have) => {
      const a = normalize(need), b = normalize(have);
      return Boolean(a && b && (a === b || (a.length >= 3 && b.includes(a)) || (b.length >= 3 && a.includes(b))));
    };
    const addNames = values => {
      values.map(value => value.trim()).filter(Boolean).forEach(value => {
        if (!available.some(existing => normalize(existing) === normalize(value))) available.push(value);
      });
      renderChips(); run();
    };
    function renderChips() {
      selected.replaceChildren();
      available.forEach((value, index) => {
        const chip = node("span", "fridgeChip", value), remove = node("button", "fridgeChipRemove", "×");
        remove.type = "button"; remove.setAttribute("aria-label", "הסרת " + value);
        remove.onclick = () => { available.splice(index, 1); renderChips(); run(); };
        chip.appendChild(remove); selected.appendChild(chip);
      });
      clear.hidden = available.length === 0;
    }
    add.onclick = () => { const values = input.value.split(/[,،;\n]+/).map(value => value.trim()).filter(Boolean); if (!values.length) { input.focus(); return; } addNames(values); input.value = ""; input.focus(); };
    input.onkeydown = event => { if (event.key === "Enter") { event.preventDefault(); add.click(); } };
    clear.onclick = () => { available = []; renderChips(); run(); };
    ["ביצים", "קמח", "חלב", "סוכר", "גבינה", "תפוח אדמה", "שמן", "אורז"].forEach(value => {
      const button = node("button", "btn ghost", "＋ " + value); button.type = "button"; button.onclick = () => addNames([value]); suggestions.appendChild(button);
    });
    const minutesOf = value => {
      const text = String(value || ""), hour = text.match(/(\d+)\s*שעה/), minute = text.match(/(\d+)/);
      return hour ? Number(hour[1]) * 60 : minute ? Number(minute[1]) : 0;
    };
    function run() {
      results.replaceChildren();
      if (!available.length) { summary.textContent = "בחרו מצרכים מהרשימה או הקלידו משלכם כדי להתחיל."; return; }
      const ranked = shared.recipes.map(recipe => {
        const needs = String(recipe.ingredients || "").split(/\n+|[,;]+/).map(line => normalize(line)).filter(line => line.length > 1);
        const matched = needs.filter(need => available.some(have => sameIngredient(need, have)));
        const missing = needs.filter(need => !available.some(have => sameIngredient(need, have)));
        const mins = minutesOf(recipe.time);
        const passDiet = !diet.value || recipe.dietaryTag === diet.value;
        const passTime = !time.value || (time.selectedIndex === 1 && mins <= 15) || (time.selectedIndex === 2 && mins > 15 && mins <= 60) || (time.selectedIndex === 3 && mins > 60);
        const passDifficulty = !difficulty.value || recipe.difficulty === difficulty.value;
        return { recipe, matched, missing, needs, pass: passDiet && passTime && passDifficulty };
      }).filter(item => item.pass && item.matched.length > 0)
        .sort((a, b) => (b.matched.length / Math.max(1, b.needs.length)) - (a.matched.length / Math.max(1, a.needs.length)) || b.matched.length - a.matched.length);
      summary.textContent = ranked.length ? "נמצאו " + ranked.length + " מתכונים לפי המצרכים שבחרתם:" : "לא מצאנו התאמה עדיין. הוסיפו עוד מצרך או שנו את המסננים.";
      ranked.forEach(item => {
        const card = node("article", "fridgeResult"), name = node("h4", "", item.recipe.name), stats = node("div", "fridgeResultStats");
        const percentage = Math.round(100 * item.matched.length / Math.max(1, item.needs.length)), progress = document.createElement("progress");
        progress.max = 100; progress.value = percentage; progress.setAttribute("aria-label", "התאמת מצרכים " + percentage + " אחוז");
        stats.append(node("strong", "", item.matched.length + " מתוך " + item.needs.length + " מצרכים"), progress);
        const missing = node("p", "fridgeMissing", item.missing.length ? "חסרים: " + item.missing.join(" · ") : "יש לכם את כל המצרכים!");
        const open = node("button", "btn ghost", "פתיחת המתכון"); open.type = "button";
        open.onclick = () => { const index = shared.recipes.findIndex(recipe => recipe.id === item.recipe.id); if (index >= 0) window.openSavedRecipe?.(index); };
        card.append(name, stats, missing, open); results.appendChild(card);
      });
    }
    panel.append(entry, selected, suggestions, clear, filtersWrap, summary, results);
    renderChips(); run();
  }
  setInterval(()=>{if(document.visibilityState==="visible"&&shared.ready)refreshShared().catch(()=>{})},45000);

  window.printFamilyCookbook = () => { let area=document.getElementById("recipePrintArea");if(!area){area=node("article");area.id="recipePrintArea";document.body.appendChild(area)}area.replaceChildren(node("h1","","ספר המתכונים המשפחתי"));area.classList.add("wholeBookPrint");shared.recipes.forEach(r=>{const article=node("article","printBookRecipe"),info=[r.origin?`המתכון של ${r.origin}`:"",`מאת ${r.author||"המשפחה"}`,r.category,r.time].filter(Boolean).join(" · ");article.append(node("h2","",r.name),node("p","printOrigin",info));if(r.images?.[0]){const img=node("img");img.src=r.images[0];img.alt=r.name;article.appendChild(img)}const cols=node("div","printCols");[["מצרכים",r.ingredients],["אופן ההכנה",r.steps]].forEach(([label,text])=>{const part=node("section"),p=node("p","",Array.isArray(text)?text.join("\n"):text||"לא הוזן.");p.style.whiteSpace="pre-line";part.append(node("h3","",label),p);cols.appendChild(part)});article.appendChild(cols);area.appendChild(article)});window.print();setTimeout(()=>area.classList.remove("wholeBookPrint"),1000)};

  const oldOpenSaved = window.openSavedRecipe;
  window.openSavedRecipe = function(index) { const result=oldOpenSaved?.(index);renderRecipeExtras();return result };
  function renderRecipeExtras() { const recipe=window.currentRecipe,box=document.querySelector("#recipeModal .modalBox");if(!recipe||!box)return;let extra=box.querySelector(".familyRecipeExtras");if(!extra){extra=node("section","familyRecipeExtras");box.appendChild(extra)}extra.replaceChildren(node("h3","","👍 נוסה ואושר במשפחה"));const approvals=recipe.triedBy||[];extra.append(node("p","",approvals.length?`אושר על ידי: ${approvals.join(" · ")}`:"עוד לא קיבל אישור מבן משפחה נוסף."));const options=shared.family.filter(m=>m.name!==recipe.author&&!approvals.includes(m.name));if(options.length){const row=node("div","approvalForm"),select=document.createElement("select"),button=node("button","btn ghost","סימון נוסה ואושר");select.append(new Option("בחרו בן משפחה שניסה",""));options.forEach(m=>select.append(new Option(m.name,m.name)));button.onclick=async()=>{if(!select.value)return toast("בחרו בן משפחה שניסה את המתכון");try{await request(`/api/recipes/${id(recipe.id)}/approvals`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({member:select.value})});await refreshShared();recipe.triedBy=shared.recipes.find(r=>r.id===recipe.id)?.triedBy||[];renderRecipeExtras();toast("האישור נוסף למתכון")}catch(e){toast(messageFor(e))}};row.append(select,button);extra.appendChild(row)}
    const conversion=node("div","conversionBox"),temp=node("button","btn ghost","המרת טמפרטורות °C ↔ °F"),cups=node("button","btn ghost","כוסות לגרמים בקירוב"),note=node("small","featureHint","המרת כוסות לגרמים היא הערכה לפי סוג המצרך.");conversion.append(temp,cups,note);extra.appendChild(conversion);const content=box.querySelector(".fullRecipeContent"),columns=content?.querySelectorAll(".recipeColumns > div"),source={ingredients:String(recipe.ingredients||""),steps:String(recipe.steps||"")};const show=(a,b)=>{if(columns?.[0])columns[0].children[1].textContent=a;if(columns?.[1])columns[1].children[1].textContent=b};temp.onclick=()=>{const toF=temp.dataset.f!="1";temp.dataset.f=toF?"1":"0";const convert=s=>s.replace(/(\d+(?:[.,]\d+)?)\s*(?:°\s*([CF])|מעלות(?:\s+צלזיוס)?)/gi,(_,n,u)=>{const x=Number(n.replace(",",".")),unit=(u||"C").toUpperCase();return toF&&unit==="C"?`${Math.round(x*9/5+32)}°F`:!toF&&unit==="F"?`${Math.round((x-32)*5/9)}°C`:`${n}°${unit}`});show(convert(source.ingredients),convert(source.steps))};cups.onclick=()=>{const fraction={"¼":.25,"½":.5,"¾":.75,"⅓":1/3,"⅔":2/3,"⅛":.125,"⅜":.375,"⅝":.625,"⅞":.875};const parse=s=>{if(s.includes("ו-")){const [whole,part]=s.split("ו-");const [n,d]=part.split("/").map(Number);return Number(whole.trim())+n/d}if(s.includes("/")){const[n,d]=s.split("/").map(Number);return n/d}return fraction[s]??Number(s.replace(",","."))};const grams=s=>s.split("\n").map(line=>{const g=/קמח/.test(line)?140:/סוכר חום/.test(line)?180:/סוכר/.test(line)?200:/קקאו/.test(line)?100:/שמן/.test(line)?220:/חלב|מים/.test(line)?240:null,m=line.match(/(\d+\s*ו-\s*\d+\/\d+|\d+\/\d+|[¼½¾⅓⅔⅛⅜⅝⅞]|\d+(?:[.,]\d+)?)\s*כוס(?:ות)?/);return g&&m?line.replace(m[0],`כ־${Math.round(parse(m[1])*g)} גרם`):line}).join("\n");show(grams(source.ingredients),source.steps)};
  }
  let timerInterval = null, timerRemaining = 0, cookWakeLock = null;
  window.startRecipeTimer = (minutes) => {
    const amount = Math.max(1, Math.min(180, Number(minutes) || 15));
    timerRemaining = Math.round(amount * 60);
    clearInterval(timerInterval);
    const paint = () => { const value = `${String(Math.floor(timerRemaining / 60)).padStart(2,"0")}:${String(timerRemaining % 60).padStart(2,"0")}`; document.querySelectorAll(".recipeTimerCountdown").forEach(el => el.textContent = value); };
    paint();
    timerInterval = setInterval(() => { timerRemaining--; paint(); if (timerRemaining <= 0) { clearInterval(timerInterval); timerInterval = null; toast("⏰ הטיימר הסתיים"); try { navigator.vibrate?.([180,80,180]); } catch {} } }, 1000);
  };
  const amountFractions = {"¼":.25,"½":.5,"¾":.75,"⅓":1/3,"⅔":2/3,"⅛":.125,"⅜":.375,"⅝":.625,"⅞":.875};
  function amountValue(value) { if (amountFractions[value] != null) return amountFractions[value]; if (value.includes("ו-")) { const [whole,part]=value.split("ו-"),[n,d]=part.split("/").map(Number); return Number(whole.trim())+n/d; } if (value.includes("/")) { const[n,d]=value.split("/").map(Number); return n/d; } return Number(value.replace(",",".")); }
  function formatAmount(value) { const nearest=Math.round(value*4)/4,whole=Math.floor(nearest),fraction=nearest-whole,token=fraction===.25?"¼":fraction===.5?"½":fraction===.75?"¾":""; return whole&&token?`${whole} ו-${token}`:whole?String(whole):token||String(Number(nearest.toFixed(2))); }
  function renderRecipeExtras() {
    const recipe=window.currentRecipe,box=document.querySelector("#recipeModal .modalBox"); if(!recipe||!box)return;
    let extra=box.querySelector(".familyRecipeExtras");if(!extra){extra=node("section","familyRecipeExtras");box.appendChild(extra)}extra.replaceChildren();
    if(recipe.story||recipe.dedication||recipe.dietaryTag&&recipe.dietaryTag!=="לא צוין") {const memory=node("div","recipeMemory");if(recipe.dedication)memory.append(node("strong","","💌 הקדשה: "),node("span","",recipe.dedication));if(recipe.story)memory.append(node("p","",recipe.story));if(recipe.dietaryTag&&recipe.dietaryTag!=="לא צוין")memory.append(node("small","",`🍽️ ${recipe.dietaryTag}`));extra.appendChild(memory)}
    const approvals=recipe.triedBy||[];extra.append(node("h3","","👍 נוסה ואושר במשפחה"),node("p","",approvals.length?`אושר על ידי: ${approvals.join(" · ")}`:"עוד לא קיבל אישור מבן משפחה נוסף."));
    const candidates=shared.family.filter(m=>m.name!==recipe.author&&!approvals.includes(m.name));if(candidates.length){const row=node("div","approvalForm"),select=document.createElement("select"),button=node("button","btn ghost","סימון נוסה ואושר");select.append(new Option("בחרו בן משפחה שניסה",""));candidates.forEach(m=>select.append(new Option(m.name,m.name)));button.onclick=async()=>{if(!select.value)return toast("בחרו בן משפחה שניסה את המתכון");try{await request(`/api/recipes/${id(recipe.id)}/approvals`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({member:select.value})});await refreshShared();recipe.triedBy=shared.recipes.find(r=>r.id===recipe.id)?.triedBy||[];renderRecipeExtras();toast("האישור נוסף למתכון")}catch(e){toast(messageFor(e))}};row.append(select,button);extra.appendChild(row)}
    const tryouts=recipe.tryouts||[],gallery=node("div","tryoutGallery");gallery.append(node("h4","","📸 תמונות של בני משפחה שהכינו את המנה"));if(tryouts.length){const grid=node("div","tryoutGrid");tryouts.forEach(item=>{const card=node("figure","tryoutCard"),img=node("img");img.src=item.image;img.alt=`המנה שהכין/ה ${item.author}`;card.append(img,node("figcaption","",`${item.author} · ${new Date(item.createdAt).toLocaleDateString("he-IL")}`));grid.appendChild(card)});gallery.appendChild(grid)}
    const upload=node("div","tryoutUpload"),member=document.createElement("select"),photo=document.createElement("input"),send=node("button","btn ghost","🍽️ הכנתי את זה! הוספת תמונה");member.append(new Option("מי הכין/ה?",""));shared.family.forEach(m=>member.append(new Option(m.name,m.name)));photo.type="file";photo.accept="image/jpeg,image/png,image/webp,image/gif";photo.setAttribute("aria-label","תמונה של המנה שהכנתי");send.onclick=async()=>{const file=photo.files?.[0];if(!member.value||!file)return toast("בחרו שם והוסיפו תמונה של המנה");try{const compressed=await compressImageFile(file,1200,.78),form=new FormData();form.set("member",member.value);form.set("image",dataUrlToBlob(compressed),"dish.jpg");await request(`/api/recipes/${id(recipe.id)}/tryouts`,{method:"POST",body:form});await refreshShared();recipe.tryouts=shared.recipes.find(r=>r.id===recipe.id)?.tryouts||[];renderRecipeExtras();toast("התמונה נוספה מתחת למתכון") }catch(e){toast(messageFor(e))}};upload.append(member,photo,send);gallery.appendChild(upload);extra.appendChild(gallery);
    const content=box.querySelector(".fullRecipeContent"),columns=content?.querySelectorAll(".recipeColumns > div"),source={ingredients:String(recipe.ingredients||""),steps:String(recipe.steps||"")};
    const servingBase=parseInt(String(recipe.servings||"").match(/\d+/)?.[0]||"4",10)||4,servingRow=node("div","servingScale"),servingLabel=node("label","","🍽️ כמה מנות להכין?"),servingInput=document.createElement("input");servingInput.type="number";servingInput.min="1";servingInput.max="200";servingInput.value=String(servingBase);servingInput.setAttribute("aria-label","מספר המנות הרצוי");servingLabel.appendChild(servingInput);servingRow.append(servingLabel,node("small","featureHint",`במתכון המקורי: ${recipe.servings||`${servingBase} מנות`}`));
    let conversionMode="";const convertTemperature=s=>s.replace(/(\d+(?:[.,]\d+)?)\s*(?:°\s*([CF])|מעלות(?:\s+צלזיוס)?)/gi,(_,n,u)=>{const x=Number(n.replace(",",".")),unit=(u||"C").toUpperCase();return unit==="C"?`${Math.round(x*9/5+32)}°F`:`${Math.round((x-32)*5/9)}°C`});
    const scaleText=s=>{const multiplier=(Number(servingInput.value)||servingBase)/servingBase;return s.split("\n").map(line=>line.replace(/^(\s*)(\d+\s*ו-\s*\d+\/\d+|\d+\/\d+|[¼½¾⅓⅔⅛⅜⅝⅞]|\d+(?:[.,]\d+)?)(?=\s|$)/,(all,space,amount)=>`${space}${formatAmount(amountValue(amount)*multiplier)}`)).join("\n")};
    const show=()=>{let ingredients=scaleText(source.ingredients),steps=source.steps;if(conversionMode==="temperature"){ingredients=convertTemperature(ingredients);steps=convertTemperature(steps)}if(conversionMode==="grams"){ingredients=ingredients.split("\n").map(line=>{const grams=/קמח/.test(line)?140:/סוכר חום/.test(line)?180:/סוכר/.test(line)?200:/קקאו/.test(line)?100:/שמן/.test(line)?220:/חלב|מים/.test(line)?240:null,match=line.match(/(\d+\s*ו-\s*\d+\/\d+|\d+\/\d+|[¼½¾⅓⅔⅛⅜⅝⅞]|\d+(?:[.,]\d+)?)\s*כוס(?:ות)?/);return grams&&match?line.replace(match[0],`כ־${Math.round(amountValue(match[1])*grams)} גרם`):line}).join("\n")};if(columns?.[0])columns[0].children[1].textContent=ingredients;if(columns?.[1])columns[1].children[1].textContent=steps;const oldIng=box.querySelector("#recipeIngredients"),oldSteps=box.querySelector("#recipeSteps");if(oldIng)oldIng.textContent=ingredients;if(oldSteps)oldSteps.textContent=steps};
    servingInput.oninput=show;extra.append(servingRow);const conversion=node("div","conversionBox"),temp=node("button","btn ghost","°C ↔ °F"),cups=node("button","btn ghost","כוסות לגרמים בקירוב"),note=node("small","featureHint","המרות לגרמים הן בקירוב לפי סוג המצרך.");temp.onclick=()=>{conversionMode=conversionMode==="temperature"?"":"temperature";show()};cups.onclick=()=>{conversionMode=conversionMode==="grams"?"":"grams";show()};conversion.append(temp,cups,note);extra.appendChild(conversion);show();
    const timer=node("div","recipeTimer"),timerTitle=node("strong","","⏱️ טיימר למטבח"),timerInput=document.createElement("input"),timerStart=node("button","btn ghost","התחלת טיימר"),timerReadout=node("output","recipeTimerCountdown","15:00");timerInput.type="number";timerInput.min="1";timerInput.max="180";timerInput.value="15";timerInput.setAttribute("aria-label","משך הטיימר בדקות");timerReadout.className="recipeTimerCountdown";timerStart.onclick=()=>window.startRecipeTimer(timerInput.value);timer.append(timerTitle,timerInput,node("span","","דקות"),timerStart,timerReadout);extra.appendChild(timer);
    const grocery=node("button","btn ghost","🧺 הוספה לרשימת הקניות");grocery.onclick=()=>{addToShoppingList(recipe);const tab=document.querySelector('[data-feature="grocery"]');tab?.classList.add("hasItems")};extra.appendChild(grocery);
    const shareCard=node("button","btn ghost","🖼️ יצירת כרטיסיית מתכון לשיתוף");shareCard.onclick=()=>createRecipeCard(recipe);extra.appendChild(shareCard);
  }
  async function createRecipeCard(recipe){
    const canvas=document.createElement("canvas");canvas.width=1080;canvas.height=1350;const ctx=canvas.getContext("2d");ctx.fillStyle="#fbf5ef";ctx.fillRect(0,0,1080,1350);ctx.fillStyle="#a94721";ctx.fillRect(0,0,1080,18);ctx.fillStyle="#2d211d";ctx.textAlign="right";ctx.direction="rtl";ctx.font="bold 64px Arial";ctx.fillText(recipe.name,1000,130,900);ctx.font="32px Arial";ctx.fillStyle="#806d64";ctx.fillText([recipe.origin?`המתכון של ${recipe.origin}`:"",`מאת ${recipe.author||"המשפחה"}`,recipe.servings].filter(Boolean).join(" · "),1000,195,900);
    if(recipe.images?.[0]){try{const img=new Image();img.crossOrigin="anonymous";img.src=recipe.images[0];await img.decode();ctx.save();const maxW=920,maxH=430,scale=Math.min(maxW/img.width,maxH/img.height);ctx.drawImage(img,80,245,img.width*scale,img.height*scale);ctx.restore()}catch{}}
    const y=720;ctx.fillStyle="#a94721";ctx.font="bold 40px Arial";ctx.fillText("המצרכים",1000,y);ctx.fillStyle="#2d211d";ctx.font="30px Arial";const lines=String(recipe.ingredients||"").split(/\n+/).filter(Boolean).slice(0,10);lines.forEach((line,i)=>ctx.fillText(`• ${line}`,1000,y+58+i*48,900));ctx.font="24px Arial";ctx.fillStyle="#806d64";ctx.fillText("ספר הבישולים המשפחתי",1000,1280);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/png"));if(!blob)return toast("לא הצלחנו ליצור את הכרטיסייה");const file=new File([blob],"family-recipe.png",{type:"image/png"});if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:recipe.name,text:"מתכון מספר הבישולים המשפחתי"});return}catch(error){if(error.name==="AbortError")return}}
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`${recipe.name.replace(/[^\p{L}\p{N}-]+/gu,"-")}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast("כרטיסיית המתכון נשמרה כתמונה");
  }
  window.toggleCookingMode = async () => {
    const existing=document.getElementById("cookModeOverlay");
    if(existing){existing.remove();document.body.classList.remove("cookModeOpen");try{await cookWakeLock?.release()}catch{}cookWakeLock=null;return}
    const recipe=window.currentRecipe;if(!recipe)return;
    const overlay=node("section","cookModeOverlay");overlay.id="cookModeOverlay";overlay.setAttribute("role","dialog");overlay.setAttribute("aria-modal","true");overlay.setAttribute("aria-label",`מצב בישול: ${recipe.name}`);
    const savedKey=`cook-progress-${recipe.id}`,saved=(()=>{try{return JSON.parse(sessionStorage.getItem(savedKey)||"{}")}catch{return {}}})();
    const header=node("header","cookModeHeader"),title=node("h1","",recipe.name),close=node("button","btn primary","סיום בישול ✕");close.type="button";close.onclick=window.toggleCookingMode;header.append(title,close);overlay.appendChild(header);
    const status=node("p","cookModeStatus","בודק אם אפשר להשאיר את המסך פעיל…");overlay.appendChild(status);
    const ingredients=String(recipe.ingredients||"").split(/\n+/).map(s=>s.trim()).filter(Boolean),steps=String(recipe.steps||"").split(/\n+/).map(s=>s.trim()).filter(Boolean),allChecks=[];
    const progress=node("div","cookProgress"),progressText=node("strong","","0 מתוך 0 הושלמו"),progressBar=document.createElement("progress");progressBar.max=1;progressBar.value=0;progressBar.setAttribute("aria-label","התקדמות במתכון");progress.append(progressText,progressBar);overlay.appendChild(progress);
    const makeChecklist=(heading,items,prefix,className)=>{const section=node("section","cookGroup"),list=node("div","cookChecklist");section.append(node("h2","",heading));if(!items.length){section.append(node("p","cookEmpty","לא נוספו פרטים לחלק הזה במתכון."));return section}items.forEach((text,index)=>{const card=node("label","cookCard"),check=document.createElement("input"),copy=node("span","",text.replace(/^\d+[.)]?\s*/,""));check.type="checkbox";check.checked=Boolean(saved[`${prefix}-${index}`]);check.setAttribute("aria-label",`${heading}: ${text}`);check.onchange=()=>{saved[`${prefix}-${index}`]=check.checked;sessionStorage.setItem(savedKey,JSON.stringify(saved));card.classList.toggle("done",check.checked);updateProgress()};card.classList.toggle("done",check.checked);card.append(check,copy);list.appendChild(card);allChecks.push(check)});section.appendChild(list);section.classList.add(className);return section};
    overlay.append(makeChecklist("🧺 מצרכים",ingredients,"ingredient","cookIngredients"),makeChecklist("👩‍🍳 שלבי ההכנה",steps,"step","cookSteps"));
    function updateProgress(){const done=allChecks.filter(x=>x.checked).length,total=allChecks.length;progressText.textContent=`${done} מתוך ${total} הושלמו`;progressBar.max=Math.max(1,total);progressBar.value=done}
    updateProgress();
    const controls=node("div","cookTimerControls"),minutes=document.createElement("input"),start=node("button","btn primary","הפעלת טיימר"),readout=node("output","recipeTimerCountdown","15:00");minutes.type="number";minutes.min="1";minutes.max="180";minutes.value="15";minutes.setAttribute("aria-label","משך הטיימר בדקות");readout.className="recipeTimerCountdown";start.onclick=()=>window.startRecipeTimer(minutes.value);controls.append(minutes,node("span","","דקות"),start,readout);overlay.appendChild(controls);
    document.body.appendChild(overlay);document.body.classList.add("cookModeOpen");
    if(navigator.wakeLock?.request){try{cookWakeLock=await navigator.wakeLock.request("screen");cookWakeLock.addEventListener("release",()=>{cookWakeLock=null});status.textContent="המסך נשאר פעיל בזמן שהמתכון פתוח."}catch{status.textContent="מצב הבישול פעיל; הדפדפן לא הצליח למנוע את כיבוי המסך."}}else status.textContent="מצב הבישול פעיל; מניעת כיבוי מסך לא נתמכת בדפדפן הזה.";
  };
  document.addEventListener("visibilitychange",async()=>{if(!document.getElementById("cookModeOverlay")||document.visibilityState!=="visible"||cookWakeLock||!navigator.wakeLock?.request)return;try{cookWakeLock=await navigator.wakeLock.request("screen");cookWakeLock.addEventListener("release",()=>{cookWakeLock=null})}catch{}});
  function addDarkModeButton(){const tools=document.querySelector(".headerBottom .userTools");if(!tools||document.getElementById("darkModeToggle"))return;const button=node("button","btn ghost","");button.id="darkModeToggle";button.type="button";const apply=enabled=>{document.body.classList.toggle("darkMode",enabled);button.textContent=enabled?"☀️ מצב יום":"🌙 מצב לילה";localStorage.setItem("familyCookbookDarkMode",enabled?"1":"0")};button.onclick=()=>apply(!document.body.classList.contains("darkMode"));tools.appendChild(button);apply(localStorage.getItem("familyCookbookDarkMode")==="1")}
  addDarkModeButton();
  addEnhancementStyles();
  const featureStyle = document.createElement("style");
  featureStyle.textContent = `.familyFeatureSuite{margin:30px 0 34px;padding:26px;background:linear-gradient(135deg,#fffaf6,#f7eee8);border:1px solid var(--line);border-radius:26px}.featureHeading{display:grid;grid-template-columns:minmax(200px,1fr) 2fr;gap:22px;align-items:end}.featureHeading h2{margin:5px 0;font:700 27px Georgia,serif}.featureHeading p,.featurePanel>p{color:var(--muted);margin:4px 0 14px}.featureEyebrow{color:var(--accent);font-weight:800;font-size:13px}.featureTabs{display:flex;gap:7px;flex-wrap:wrap}.featureTabs button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:9px 13px;font:inherit;color:var(--ink);cursor:pointer}.featureTabs button.active{background:var(--accent);border-color:var(--accent);color:#fff}.featurePanel{margin-top:18px;padding:20px;background:#fff;border:1px solid var(--line);border-radius:20px;min-height:90px}.featuredRecipe{display:grid;grid-template-columns:minmax(180px,300px) 1fr;gap:22px;align-items:center}.featuredRecipe>img{width:100%;height:210px;object-fit:cover;border-radius:16px}.featuredCopy h3{font-size:26px;margin:8px 0}.featuredCopy p,.featureHint{color:var(--muted)}.featurePanel h3{margin:0 0 10px}.menuBuilder,.storyForm{display:grid;gap:12px;margin:16px 0}.menuBuilder>input,.storyForm input:not([type=file]),.storyForm select,.storyForm textarea,.approvalForm select{font:inherit;padding:12px;border:1px solid var(--line);border-radius:12px;background:#fff;color:var(--ink)}.storyForm textarea{min-height:110px;resize:vertical}.menuChoices{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:7px}.menuChoice{display:flex;gap:8px;align-items:center;background:#fffaf6;border:1px solid var(--line);border-radius:12px;padding:9px}.savedMenus,.storyGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}.savedMenu,.storyCard{padding:15px;border:1px solid var(--line);border-radius:16px;background:#fffaf6}.savedMenu{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.savedMenu h4{margin:0 auto 0 0}.textButton{border:0;background:transparent;color:var(--accent);cursor:pointer;font:inherit}.shoppingList{margin-top:20px;padding:18px;background:#f8f1eb;border-radius:16px}.shoppingRecipe{border-top:1px solid var(--line);padding:8px 0}.shoppingRecipe h4{margin:6px 0}.familyPhotoGallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:15px}.galleryTile{padding:0;overflow:hidden;background:#fff;border:1px solid var(--line);border-radius:15px;cursor:pointer;text-align:right;font:inherit}.galleryTile img{width:100%;height:150px;object-fit:cover;display:block}.galleryTile span{display:block;padding:9px}.storyCard img{width:100%;height:170px;object-fit:cover;border-radius:12px}.storyCard h4{margin:12px 0 5px}.storyCard p{white-space:pre-wrap}.storyCard small{color:var(--muted)}.updateList{display:grid;gap:6px;margin:12px 0}.updateRecipe{padding:12px;border:1px solid var(--line);border-radius:12px;background:#fffaf6;text-align:right;cursor:pointer;font:inherit}.familyRecipeExtras{margin:20px 0;padding:18px;background:#fbf6f2;border-radius:16px}.familyRecipeExtras h3{margin-top:0}.approvalForm,.conversionBox{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin:12px 0}.conversionBox{padding-top:12px;border-top:1px solid var(--line)}.featureSubhead{margin-top:22px!important}.wholeBookPrint .printBookRecipe{break-after:page;page-break-after:always;margin:24px 0}.wholeBookPrint .printBookRecipe>img{max-width:100%;max-height:260px;object-fit:contain}.wholeBookPrint .printCols{display:grid;grid-template-columns:1fr 1fr;gap:22px}.wholeBookPrint .printCols p{white-space:pre-line}.wholeBookPrint h2{font-size:20pt}.wholeBookPrint h3{font-size:14pt}@media(max-width:760px){.familyFeatureSuite{padding:16px}.featureHeading{grid-template-columns:1fr}.featurePanel{padding:14px}.featuredRecipe{grid-template-columns:1fr}.featuredRecipe>img{height:190px}.wholeBookPrint .printCols{grid-template-columns:1fr}}@media print{#recipePrintArea.wholeBookPrint .printBookRecipe{display:block;break-after:page;page-break-after:always}#recipePrintArea.wholeBookPrint{position:absolute!important;inset:0!important;padding:16px!important}#recipePrintArea.wholeBookPrint .printBookRecipe>img{width:55%;max-height:210px;object-fit:contain}}`;
  document.head.appendChild(featureStyle);
  const cookingPolish = document.createElement("style");
  cookingPolish.textContent = `.servingScale,.recipeTimer,.tryoutUpload,.fridgeFilters,.fridgeChips,.fridgeResults,.featureButtonRow,.groceryCombined{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.servingScale,.recipeTimer{padding:13px;margin:12px 0;background:#fff;border:1px solid var(--line);border-radius:15px}.servingScale label{display:flex;align-items:center;gap:10px;font-weight:700}.servingScale input,.recipeTimer input,.cookTimerControls input{width:86px;padding:9px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink);font:inherit}.recipeTimerCountdown{font-variant-numeric:tabular-nums;font-weight:800;color:var(--accent);font-size:20px}.recipeMemory{padding:15px 18px;margin:10px 0;background:linear-gradient(135deg,#fff7ee,#f7ebe4);border-radius:14px;line-height:1.7}.tryoutGallery{margin:16px 0}.tryoutGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px}.tryoutCard{margin:0;background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}.tryoutCard img{width:100%;height:145px;object-fit:cover}.tryoutCard figcaption{padding:8px;font-size:14px}.tryoutUpload{margin-top:12px}.tryoutUpload input[type=file]{max-width:100%}.fridgeInput{display:block;width:100%;min-height:88px;padding:12px;border:1px solid var(--line);border-radius:14px;font:inherit}.fridgeFilters select{max-width:100%;padding:9px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink);font:inherit}.fridgeResults{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));margin-top:14px}.fridgeResult{padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--card)}.groceryCombined{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));padding-inline-start:24px}.cookModeOpen{overflow:hidden}.cookModeOverlay{position:fixed;inset:0;z-index:100;background:var(--bg);color:var(--ink);overflow:auto;padding:clamp(18px,4vw,52px);font-size:clamp(19px,2.3vw,25px)}.cookModeHeader{position:sticky;top:-1px;display:flex;align-items:center;justify-content:space-between;gap:15px;padding:8px 0;background:var(--bg)}.cookModeHeader h1{font-size:clamp(27px,4vw,40px);margin:0}.cookChecklist{max-width:900px;margin:22px auto;padding-inline-start:38px}.cookStep{padding:15px 8px;border-bottom:1px solid var(--line)}.cookStep label{display:flex;align-items:flex-start;gap:15px}.cookStep input{width:26px;height:26px;flex:0 0 26px;accent-color:var(--accent)}.cookStep input:checked+span{text-decoration:line-through;opacity:.58}.cookTimerControls{display:flex;justify-content:center;align-items:center;gap:12px;flex-wrap:wrap;padding:18px}.darkMode{--bg:#171819;--card:#232526;--ink:#f7eee8;--muted:#c0b4ac;--soft:#39302c;--line:#49413d;--accent:#e58354;--accent2:#f09c73;background:var(--bg);color:var(--ink)}.darkMode header,.darkMode footer,.darkMode .featurePanel,.darkMode .familyFeatureSuite,.darkMode .familyRecipeExtras,.darkMode .stat,.darkMode .card,.darkMode .filters,.darkMode .modalBox,.darkMode .story,.darkMode .person,.darkMode .btn.ghost,.darkMode .featureTabs button,.darkMode .search,.darkMode .recipeTimer,.darkMode .servingScale{background:var(--card);color:var(--ink)}.darkMode input,.darkMode select,.darkMode textarea{background:var(--bg)!important;color:var(--ink)!important}.darkMode .recipeMemory{background:#332c28}.darkMode .savedMenu,.darkMode .storyCard,.darkMode .fridgeResult,.darkMode .updateRecipe{background:#282a2b;color:var(--ink)}@media(max-width:640px){.tryoutUpload>*{width:100%}.servingScale{align-items:flex-start}.cookModeHeader{align-items:flex-start}.featureButtonRow>*{flex:1 1 100%}}@media print{body>*:not(#recipePrintArea){display:none!important}#recipePrintArea{display:block!important;position:static!important;color:#111;background:#fff;padding:12mm;font:12pt Arial,sans-serif}#recipePrintArea h1{font-size:24pt}#recipePrintArea .printCols{display:grid;grid-template-columns:1fr 1fr;gap:12mm}}`;
  document.head.appendChild(cookingPolish);
  const familyFeaturesStyle=document.createElement("style");familyFeaturesStyle.textContent=`.kitchenToolCard,.substituteCard,.plannerDay,.eventCard{display:flex;flex-direction:column;gap:10px;padding:16px;border:1px solid var(--line);border-radius:16px;background:var(--card);color:var(--ink)}.kitchenToolCard{display:flex;flex-direction:row;align-items:center;flex-wrap:wrap;margin:12px 0}.kitchenToolCard input,.kitchenToolCard select,.plannerForm input,.plannerDay select,.plannerDay button{max-width:100%;padding:10px;border:1px solid var(--line);border-radius:11px;background:var(--card);color:var(--ink);font:inherit}.kitchenResult{font-size:20px;font-weight:800;color:var(--accent)}.substituteGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:12px 0}.substituteCard{line-height:1.5}.plannerWeek{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin:12px 0}.plannerDay{align-items:stretch}.planRecipe{display:block;padding:8px;background:var(--soft);border-radius:9px}.plannerForm.plannerForm{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin:12px 0}.plannerForm>*{min-width:0}.pollOptions{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.eventList{display:grid;gap:8px}.eventCard{flex-direction:row;align-items:center;flex-wrap:wrap}.eventCard strong{margin-inline-end:auto}.chefBadges{display:block;margin-top:8px!important;color:#865116!important;font-weight:700}.surpriseRecipe{margin-top:12px}@media(max-width:680px){.featureHeading .surpriseRecipe{width:100%}.kitchenToolCard>*{flex:1 1 100%}.eventCard>*{max-width:100%}}`;
  document.head.appendChild(familyFeaturesStyle);
  const plannerCalendarStyle=document.createElement("style");
  plannerCalendarStyle.textContent=`.plannerCalendar{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:7px;margin:16px 0}.plannerDate{position:relative;min-height:68px;padding:7px 3px;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--ink);font:inherit;cursor:pointer;display:grid;place-items:center;gap:2px}.plannerDate:hover,.plannerDate:focus-visible{border-color:var(--accent);outline:2px solid transparent}.plannerDate.selected{background:var(--accent);border-color:var(--accent);color:#fff}.plannerWeekday{font-size:12px;opacity:.75}.plannerDate strong{font-size:18px}.plannerDot{position:absolute;bottom:5px;width:6px;height:6px;overflow:hidden;border-radius:50%;background:currentColor;font-size:0}.plannerSelected{margin:0 0 8px;font-weight:700}.compactPlannerForm{margin:0 0 12px!important}`;
  document.head.appendChild(plannerCalendarStyle);
  const achievementStyle=document.createElement("style");achievementStyle.textContent=`.chefBadgeList{display:grid;gap:6px;margin-top:10px;text-align:center}.chefBadge{display:block;padding:6px 8px;border:1px solid var(--line);border-radius:11px;background:var(--soft);color:var(--muted);font-size:13px;line-height:1.4;overflow-wrap:anywhere}.chefBadge.earned{background:#fff1c9;border-color:#e6c66d;color:#674800;font-weight:800}.darkMode .chefBadge.earned{background:#4a3b16;border-color:#796222;color:#ffe39a}`;document.head.appendChild(achievementStyle);
  const fridgeStyle=document.createElement("style");fridgeStyle.textContent=`.fridgeEntry{display:flex;align-items:stretch;gap:9px;flex-wrap:wrap;margin:12px 0}.fridgeEntry input{flex:1;min-width:170px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--ink);font:inherit}.fridgeSelected,.fridgeSuggestions{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.fridgeChip{display:inline-flex;align-items:center;gap:8px;padding:7px 11px;border-radius:999px;background:var(--soft);border:1px solid var(--line)}.fridgeChipRemove{border:0;background:transparent;color:var(--accent);font-size:20px;line-height:1;padding:0 2px;cursor:pointer}.fridgeSummary{font-weight:700;margin-top:16px}.fridgeFilterDetails>summary{cursor:pointer;padding:9px 0;font-weight:700}.fridgeResultStats{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.fridgeResultStats progress{flex:1;min-width:90px;height:10px;accent-color:var(--accent)}.fridgeMissing{color:var(--muted);line-height:1.5}.fridgeEntry button{min-height:44px}@media(max-width:640px){.fridgeEntry input{min-width:100%}.fridgeEntry button{flex:1}}`;document.head.appendChild(fridgeStyle);
  const cookModeStyle=document.createElement("style");cookModeStyle.textContent=`.cookModeOverlay{background:var(--bg);padding:clamp(14px,3vw,36px);font-size:20px}.cookModeOverlay>.featureHint{padding:12px 15px;background:var(--soft);border-radius:12px}.cookModeHeader{position:sticky;top:0;z-index:2;background:var(--bg);border-bottom:1px solid var(--line);padding:10px 0}.cookModeHeader h1{font-size:clamp(26px,5vw,38px);line-height:1.2}.cookModeStatus{max-width:950px;margin:14px auto;padding:10px 14px;border-radius:12px;background:var(--soft);font-size:16px}.cookProgress{position:sticky;top:72px;z-index:1;display:flex;align-items:center;gap:14px;max-width:950px;margin:0 auto;padding:10px 14px;background:var(--card);border:1px solid var(--line);border-radius:14px}.cookProgress progress{width:100%;height:14px;accent-color:var(--accent)}.cookGroup{max-width:950px;margin:25px auto}.cookGroup h2{font-size:clamp(24px,4vw,31px);margin:16px 0}.cookChecklist{display:grid;gap:12px;margin:0;padding:0}.cookCard{display:flex;align-items:flex-start;gap:16px;min-height:76px;padding:18px;background:var(--card);border:1px solid var(--line);border-radius:17px;box-shadow:0 4px 14px rgba(45,33,29,.05);font-size:clamp(20px,4vw,26px);line-height:1.5;cursor:pointer;touch-action:manipulation}.cookCard input{width:30px;height:30px;flex:0 0 30px;margin-top:3px;accent-color:var(--accent)}.cookCard.done{background:var(--green);border-color:#a9c89d}.cookCard.done span{text-decoration:line-through;opacity:.65}.cookEmpty{padding:15px;background:var(--card);border-radius:13px;color:var(--muted)}.cookTimerControls{position:sticky;bottom:0;z-index:2;background:var(--bg);border-top:1px solid var(--line);margin:20px -10px -10px;padding:14px}.cookTimerControls .btn{min-height:48px}@media(max-width:520px){.cookModeHeader{top:0}.cookProgress{top:60px}.cookProgress strong{white-space:nowrap;font-size:14px}.cookCard{min-height:72px;padding:14px}.cookTimerControls{justify-content:space-between}}`;
  document.head.appendChild(cookModeStyle); renderEventRecipes(); renderFeatureSuite();

  const originalRenderRecipes = window.renderRecipes;
  if (typeof originalRenderRecipes === "function") window.renderRecipes = function (...args) { const result = originalRenderRecipes.apply(this, args); document.querySelectorAll("#savedRecipes .card").forEach(card => { const title = card.querySelector(".recipeNameAboveActions")?.textContent, recipe = (window.getRecipes?.() || []).find(item => item.name === title); if (recipe?.origin && !card.querySelector(".recipeOriginCard")) { const tag = document.createElement("div"); tag.className = "recipeOriginCard"; tag.textContent = `המתכון של ${recipe.origin}`; card.querySelector(".recipeAuthorLine")?.after(tag); } }); renderEventRecipes(); return result; };

  window.shareCurrentRecipe = () => {
    const r = window.currentRecipe; if (!r) return;
    const lines = [`מתכון משפחתי: ${r.name}`, r.origin ? `המתכון של ${r.origin}` : "", `מאת: ${r.author || "המשפחה"}`, `מצרכים: ${Array.isArray(r.ingredients) ? r.ingredients.join(", ") : r.ingredients || "לא צוינו"}`, `אופן ההכנה: ${Array.isArray(r.steps) ? r.steps.join("; ") : r.steps || "לא צוינו"}`, location.href].filter(Boolean);
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`, "_blank", "noopener,noreferrer");
  };

  window.printCurrentRecipe = () => {
    const r = window.currentRecipe; if (!r) return;
    let area = document.getElementById("recipePrintArea"); if (!area) { area = document.createElement("article"); area.id = "recipePrintArea"; document.body.appendChild(area); }
    area.replaceChildren();
    const heading = document.createElement("h1"); heading.textContent = r.name || "מתכון משפחתי"; area.appendChild(heading);
    const info = document.createElement("p"); info.textContent = [r.category, r.time, r.servings].filter(Boolean).join(" · "); area.appendChild(info);
    if (r.origin) { const origin = document.createElement("p"); origin.className = "printOrigin"; origin.textContent = `המתכון של ${r.origin}`; area.appendChild(origin); }
    if (r.dedication || r.story) { const memory = document.createElement("p"); memory.textContent = [r.dedication ? `הקדשה: ${r.dedication}` : "", r.story || ""].filter(Boolean).join("\n"); memory.style.whiteSpace = "pre-line"; area.appendChild(memory); }
    const cols = document.createElement("div"); cols.className = "printCols";
    [["מצרכים", r.ingredients], ["אופן ההכנה", r.steps]].forEach(([title, body]) => { const section = document.createElement("section"), h = document.createElement("h2"), p = document.createElement("p"); h.textContent = title; p.style.whiteSpace = "pre-line"; p.textContent = Array.isArray(body) ? body.join("\n") : body || "לא הוזן."; section.append(h, p); cols.appendChild(section); });
    area.appendChild(cols); window.print();
  };

  async function fillRecipeComments() {
    const r = window.currentRecipe, list = document.getElementById("recipeCommentsList"), select = document.getElementById("commentAuthor");
    if (!r || !list || !select) return;
    select.replaceChildren();
    const prompt = document.createElement("option"); prompt.value = ""; prompt.textContent = "בחרו את השם שלכם"; select.appendChild(prompt);
    const members = window.getFamily?.() || [];
    members.forEach(m => { const option = document.createElement("option"); option.value = m.name; option.textContent = m.name; select.appendChild(option); });
    const logged = localStorage.getItem(DEMO_USER_KEY) || ""; if (members.some(m => m.name === logged)) select.value = logged;
    list.textContent = "טוען תגובות…";
    try {
      const data = await request(`/api/recipes/${id(r.id)}/comments`);
      list.replaceChildren();
      if (!data.comments?.length) { list.textContent = "עדיין אין תגובות — הוסיפו טיפ ראשון למתכון."; return; }
      data.comments.forEach(comment => { const item = document.createElement("div"), body = document.createElement("p"), by = document.createElement("small"); item.className = "commentItem"; body.textContent = comment.body; by.textContent = `${comment.author} · ${new Date(comment.createdAt).toLocaleDateString("he-IL")}`; item.append(body, by); list.appendChild(item); });
    } catch { list.textContent = "לא הצלחנו לטעון תגובות כרגע."; }
  }
  window.loadRecipeComments = fillRecipeComments;
  function renderRating(){const r=window.currentRecipe,box=document.querySelector('#recipeModal .modalBox');if(!r||!box)return;let area=box.querySelector('.familyRating');if(!area){area=node('section','familyRecipeExtras familyRating');box.querySelector('.recipeComments')?.before(area)||box.appendChild(area)}const ratings=r.ratings||[],avg=ratings.length?(ratings.reduce((s,x)=>s+Number(x.value),0)/ratings.length).toFixed(1):'—',mine=ratings.find(x=>x.member===currentDemoUser)?.value||0;area.replaceChildren(node('h3','','דירוג משפחתי'),node('p','',ratings.length?`${avg} ⭐ מתוך ${ratings.length} דירוגים`:'אין עדיין דירוגים'),node('strong','','כמה אהבתם?'));const stars=node('div','ratingStars');for(let n=1;n<=5;n++){const b=node('button','',n<=mine?'★':'☆');b.type='button';b.style.cssText='font-size:28px;color:#d17a22;background:transparent';b.onclick=async()=>{if(!currentDemoUser)return toast('בחרו משתמש כדי לדרג');await request(`/api/recipes/${id(r.id)}/ratings`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({member:currentDemoUser,rating:n})});await refreshShared();Object.assign(r,shared.recipes.find(x=>x.id===r.id)||{});renderRating();toast('הדירוג נשמר')};stars.appendChild(b)}area.appendChild(stars)}
  window.submitRecipeComment = async () => {
    const r = window.currentRecipe, author = document.getElementById("commentAuthor")?.value || "", body = document.getElementById("commentBody")?.value.trim() || "";
    if (!r) return; if (!author) { toast("בחרו את השם שלכם כדי להוסיף תגובה"); return; } if (!body) { toast("כתבו תגובה או טיפ קצר"); return; }
    try { await request(`/api/recipes/${id(r.id)}/comments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ author, body }) }); document.getElementById("commentBody").value = ""; await fillRecipeComments(); toast("התגובה נוספה לכולם"); }
    catch (error) { toast(messageFor(error)); }
  };
  const openRecipe = window.openSavedRecipe;
  window.openSavedRecipe = function (index) {
    const result = openRecipe?.(index); const r = window.currentRecipe;
    const origin = document.getElementById("detailOrigin"); if (origin) { origin.textContent = r?.origin ? `המתכון של ${r.origin}` : ""; origin.hidden = !r?.origin; }
    document.getElementById("commentBody") && (document.getElementById("commentBody").value = "");
    document.querySelector('.familyRating')?.remove(); fillRecipeComments(); renderEventRecipes(); return result;
  };
  const editRecipe = window.editCurrentRecipe;
  window.editCurrentRecipe = function (...args) {
    const result = editRecipe?.apply(this, args);
    const input = document.getElementById("editRecipeOrigin"); if (input) input.value = window.currentRecipe?.origin || "";
    const dedication = document.getElementById("editRecipeDedication"); if (dedication) dedication.value = window.currentRecipe?.dedication || "";
    const diet = document.getElementById("editRecipeDietaryTag"); if (diet) diet.value = window.currentRecipe?.dietaryTag || "לא צוין";
    return result;
  };

  function videoDuration(file) { return new Promise((resolve, reject) => { const url = URL.createObjectURL(file), video = document.createElement("video"); video.preload = "metadata"; video.onloadedmetadata = () => { const seconds = video.duration; URL.revokeObjectURL(url); (Number.isFinite(seconds) && seconds > 0 && seconds <= 30 ? resolve(seconds) : reject(new Error("VIDEO_DURATION"))); }; video.onerror = () => { URL.revokeObjectURL(url); reject(new Error("VIDEO")); }; video.src = url; }); }
  async function validateVideoFile(file) { if (file.size > 5 * 1024 * 1024) throw new Error("VIDEO_SIZE"); if (!/^video\/(mp4|webm|quicktime|ogg)$/i.test(file.type)) throw new Error("INVALID_VIDEO"); await videoDuration(file); }
  ["recipeVideo", "editRecipeVideo"].forEach(fieldId => document.getElementById(fieldId)?.addEventListener("change", async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try { await validateVideoFile(file); toast("הסרטון מוכן להעלאה משותפת: MP4, WebM, MOV או OGG, עד 5MB ועד 30 שניות."); }
    catch (error) { toast(error.message === "VIDEO_SIZE" ? "הסרטון גדול מדי — המגבלה היא 5MB" : error.message === "VIDEO_DURATION" ? "הסרטון ארוך מדי או שלא ניתן לקרוא את משכו — המגבלה היא 30 שניות" : "אפשר להעלות MP4, WebM, MOV או OGG עד 5MB"); event.target.value = ""; }
  }));

  // English interface layer — family recipes remain in their original language.
  const english = new Map(Object.entries({
    "ספר הבישולים שלנו":"Our Family Cookbook","בית":"Home","מתכונים":"Recipes","ארוחות":"Meals","המשפחה שלנו":"Our Family","❤️ מועדפים":"❤️ Favorites","חיפוש מתכון או מצרך":"Search recipes or ingredients","שלום, גלעד":"Hello, Gilad","✉️ הודעות":"✉️ Messages","החלפת משתמש":"Switch user","מצב לילה":"Dark mode","🌙 מצב לילה":"🌙 Dark mode","☀️ מצב יום":"☀️ Light mode","＋ הוספת מתכון":"＋ Add recipe","+ הוספת מתכון":"+ Add recipe","+ הוספת מתכון למשפחה":"+ Add family recipe",
    "ספר המתכונים המשפחתי שלנו":"Our family recipe book","הטעמים שעוברים מדור לדור":"Flavors passed down through generations","כל המתכונים, הסיפורים והסודות של המשפחה במקום אחד — ועכשיו גם מקום שבו כל אחד יכול ליצור את ספר המתכונים שלו.":"All the family recipes, stories, and secrets in one place — with room for everyone to build the cookbook together.","חפשי מתכון, מצרך, ארוחה...":"Search recipes, ingredients, or meals...","מצאי לי מתכון":"Find a recipe","אין רעיון לארוחת ערב?":"No dinner idea?","🎲 תציעו לי משהו":"🎲 Suggest something",
    "המתכונים שלנו":"Our recipes","המתכונים המשפחתיים מחכים לכם כאן.":"Your family recipes are waiting here.","עוד דברים שכיף לעשות יחד":"More things to enjoy together","הספר המשפחתי מתרחב":"The family book keeps growing","תכננו ארוחה, גלו כלים שימושיים ומצאו מה חדש בספר.":"Plan a meal, explore useful tools, and see what is new in the book.","⭐ מתכון השבוע":"⭐ Recipe of the week","🧁 כלי מטבח":"🧁 Kitchen tools","🗓️ תכנון משפחתי":"🗓️ Family planning","🍽️ תפריטי שבת וחג":"🍽️ Menus","🥕 מה יש במקרר?":"🥕 What is in the fridge?","🧺 רשימת קניות":"🧺 Shopping list","📷 גלריית תמונות":"📷 Photo gallery","📖 סיפורי משפחה":"📖 Family stories","🔔 עדכונים":"🔔 Updates","📕 הדפסת הספר":"📕 Print the book","🎲 הפתיעו אותי עם מתכון":"🎲 Surprise me with a recipe",
    "💡 יש לכם משוב או רעיון לשיפור האתר?":"💡 Have feedback or an idea to improve the site?","לחצו כאן וספרו לנו":"Click here and tell us","מתכונים משפחתיים":"Family recipes","טבחים במשפחה":"Family cooks","קטגוריות":"Categories","מתכונים שנשמרו":"Saved recipes","המשפחה שלנו":"Our family","עד 20 בני משפחה יכולים להוסיף מתכונים ותמונות. כל מה שנשמר מופיע לכולם דרך הקישור המשותף.":"Up to 20 family members can add recipes and photos. Everything saved is shared with everyone using this link.","+ הוספת בן/בת משפחה":"+ Add family member","כל המתכונים":"All recipes","סנני, חפשי ושמרי את מה שאת אוהבת":"Filter, search, and save what you love","הכל":"All","ארוחות בוקר":"Breakfast","ארוחות צהריים":"Lunch","ארוחות ערב":"Dinner","קינוחים":"Desserts","קל ומהיר":"Quick & easy","🌾🚫 ללא גלוטן":"🌾🚫 Gluten-free","רמת קושי:":"Difficulty:","קל":"Easy","בינוני":"Medium","מאתגר":"Challenging",
    "מתכונים לחגים ולאירועים":"Recipes for holidays and events","בחרו אירוע ונציג רעיונות מהספר המשפחתי.":"Choose an occasion and we will show ideas from the family book.","לאיזה אירוע?":"Which occasion?","שבת":"Shabbat","ראש השנה":"Rosh Hashanah","חנוכה":"Hanukkah","פסח":"Passover","יום הולדת":"Birthday","יש לכם מתכון ששווה לשמור לדורות?":"Do you have a recipe worth saving for generations?","הוסיפו אותו לספר המשפחתי ושתפו את הסיפור שמאחוריו.":"Add it to the family book and share the story behind it.","🛒 רשימת קניות מאוחדת":"🛒 Combined shopping list","בחרו מתכונים לרשימה":"Choose recipes for your list","סמנו את המתכונים שתרצו להכין, וניצור רשימת מצרכים אחת.":"Select the recipes you want to make and we will create one ingredient list.","יצירת הרשימה":"Create list","עדיין לא בחרתם מתכונים.":"You have not selected any recipes yet.","רשימת הקניות שלכם":"Your shopping list","חזרה לבחירה":"Back to selection","העתקת הרשימה":"Copy list","העתקנו את רשימת הקניות.":"Your shopping list has been copied.",
    "יצירת קשר":"Contact","לשאלות או פניות אישיות, אפשר לכתוב לנו ישירות במייל.":"For questions or personal inquiries, email us directly.","משוב ורעיונות לשיפור":"Feedback and ideas","נשמח לשמוע מה אהבתם, מה כדאי לשנות ואילו דברים תרצו שנוסיף לאתר.":"We would love to hear what you liked, what we should change, and what you would like us to add.","השם שלכם (לא חובה)":"Your name (optional)","סוג הפנייה":"Message type","משוב":"Feedback","רעיון לשיפור":"Improvement idea","פנייה בנושא נגישות":"Accessibility request","פנייה בנושא פרטיות":"Privacy request","דיווח על תוכן פוגע או מפר זכויות":"Report harmful or infringing content","בקשת מחיקה או הסרת תוכן":"Deletion or content removal request","מה תרצו לספר לנו?":"What would you like to tell us?","שליחת הפנייה":"Send message","מידע ועזרה":"Information & help","תנאי שימוש":"Terms of use","מדיניות פרטיות":"Privacy policy","הצהרת נגישות":"Accessibility statement","שימוש משפחתי בלבד":"Family use only",
    "מי מוסיף/ה את המתכון?":"Who is adding this recipe?","חייבים לבחור שם לפני שממשיכים לטופס המתכון.":"Please choose a name before continuing to the recipe form.","בחרו שם":"Choose a name","השם לא ברשימה? כתבו אותו כאן":"Name not on the list? Write it here","המשך לטופס המתכון":"Continue to recipe form","הוספת מתכון חדש":"Add a new recipe","שם המתכון":"Recipe name","המתכון של… (למשל: סבתא רחל)":"Recipe from… (for example: Grandma Rachel)","הקדשה משפחתית":"Family dedication","קטגוריה":"Category","זמן הכנה":"Prep time","מספר מנות":"Servings","סוג המתכון":"Recipe type","סיפור המתכון":"Recipe story","מצרכים":"Ingredients","שלבי הכנה":"Preparation steps","שמירת המתכון":"Save recipe","חזרה לבחירת השם":"Back to name selection","ביטול":"Cancel","עריכת תמונות":"Edit photos","עריכת כל המתכון":"Edit full recipe","שמירת התמונות":"Save photos","שמירת כל השינויים":"Save all changes","🔖 שמירת המתכון":"🔖 Save recipe","🗑️ מחיקת מתכון":"🗑️ Delete recipe","⬇ הורדת המתכון":"⬇ Download recipe","💬 שיתוף בוואטסאפ":"💬 Share on WhatsApp","🖨️ הדפסה":"🖨️ Print","👩‍🍳 להתחיל לבשל":"👩‍🍳 Start cooking","אופן ההכנה":"Instructions","תגובות והערות":"Comments and notes","השם שלך":"Your name","תגובה או טיפ":"Comment or tip","הוספת תגובה":"Add comment","הוספת בן/בת משפחה":"Add family member","תמונת פרופיל":"Profile photo","תיאור קצר":"Short description","שמירת המשתמש":"Save member"
  }));
  const englishAttrs = new Map(Object.entries({"למשל: גלעד":"For example: Gilad","כתבו כאן את המשוב או הרעיון שלכם...":"Write your feedback or idea here...","השם של מי שמוסיף/ה את המתכון":"Name of the person adding the recipe","למשל: המתכון שלנו":"For example: Our recipe","אפשר להשאיר ריק":"Leave blank if you like","למשל: העוגה האהובה על אבא לחג":"For example: Dad's favorite holiday cake","למשל: 6 מנות":"For example: 6 servings","מי הכין אותו? מאיפה הוא הגיע? למה הוא מיוחד?":"Who made it? Where did it come from? Why is it special?","שם בן/בת המשפחה":"Family member's name","למשל: אוהבת לאפות ולבשל":"For example: Loves baking and cooking"}));
  function translateElement(el) { if (el.nodeType === Node.TEXT_NODE) { const value = el.nodeValue.trim(); if (english.has(value)) el.nodeValue = el.nodeValue.replace(value, english.get(value)); return; } if (el.nodeType !== Node.ELEMENT_NODE || el.closest("#savedRecipes, #recipeIngredients, #recipeSteps, #recipeTitle")) return; ["placeholder","aria-label","title"].forEach(attr => { const value=el.getAttribute(attr); if (englishAttrs.has(value)) el.setAttribute(attr, englishAttrs.get(value)); else if (english.has(value)) el.setAttribute(attr, english.get(value)); }); [...el.childNodes].forEach(translateElement); }
  function translateInterface() { document.documentElement.lang="en"; document.documentElement.dir="ltr"; document.title="Our Family Cookbook"; translateElement(document.body); const languageButton=document.getElementById("languageToggle"); if(languageButton) languageButton.textContent="🌐 עברית"; }
  window.toggleInterfaceLanguage = function () { const englishMode=localStorage.getItem("familyCookbookLanguage")==="en"; localStorage.setItem("familyCookbookLanguage",englishMode?"he":"en"); location.reload(); };
  if (localStorage.getItem("familyCookbookLanguage")==="en") { translateInterface(); new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(translateElement))).observe(document.body, {childList:true,subtree:true}); }
  const primaryRecipes=document.getElementById("recipes"), eventBoard=document.querySelector("#home .eventBoard");
  if(primaryRecipes && eventBoard) eventBoard.insertAdjacentElement("afterend", primaryRecipes);
  window.suggestDinnerRecipe = function () {
    const recipes = window.getRecipes?.() || shared.recipes || [];
    const dinnerRecipes = recipes.filter(recipe => /dinner|ערב/i.test(String(recipe.category || "")));
    const choices = dinnerRecipes.length ? dinnerRecipes : recipes;
    if (!choices.length) { toast("Add a recipe first, then we can suggest one for dinner."); return; }
    const chosen = choices[Math.floor(Math.random() * choices.length)];
    const index = recipes.findIndex(recipe => recipe.id === chosen.id);
    if (index >= 0) window.openSavedRecipe?.(index);
  };
  window.openShoppingListBuilder = function () {
    const recipes = window.getRecipes?.() || shared.recipes || [];
    let modal = document.getElementById("shoppingListBuilderModal");
    if (!modal) { modal=document.createElement("div"); modal.id="shoppingListBuilderModal"; modal.className="modal"; document.body.appendChild(modal); }
    const showPicker = () => {
      modal.innerHTML=`<div class="modalBox"><button class="close" type="button">×</button><h2>בחרו מתכונים לרשימה</h2><p>סמנו את המתכונים שתרצו להכין, וניצור רשימת מצרכים אחת.</p><div class="menuChoices">${recipes.map((recipe,index)=>`<label class="menuChoice"><input type="checkbox" value="${index}"><span>${recipe.name}</span></label>`).join("")}</div><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px"><button class="btn primary" type="button" id="buildShoppingList">יצירת הרשימה</button><button class="btn ghost" type="button" id="closeShoppingBuilder">ביטול</button></div></div>`;
      modal.classList.add("open"); modal.querySelector(".close").onclick=()=>modal.classList.remove("open"); modal.querySelector("#closeShoppingBuilder").onclick=()=>modal.classList.remove("open");
      modal.querySelector("#buildShoppingList").onclick=()=>{ const selected=[...modal.querySelectorAll("input:checked")].map(input=>recipes[Number(input.value)]).filter(Boolean); if(!selected.length){toast("עדיין לא בחרתם מתכונים.");return;} const items=new Map(); selected.forEach(recipe=>String(recipe.ingredients||"").split(/\n+/).map(item=>item.trim()).filter(Boolean).forEach(item=>items.set(item,(items.get(item)||0)+1))); const rows=[...items].map(([item,count])=>`<li>${item}${count>1?` <small>(${count}×)</small>`:""}</li>`).join(""); modal.innerHTML=`<div class="modalBox"><button class="close" type="button">×</button><h2>🛒 רשימת הקניות שלכם</h2><p>${selected.map(recipe=>recipe.name).join(" · ")}</p><ul class="combinedShopping">${rows||"<li>אין מצרכים במתכונים שנבחרו.</li>"}</ul><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px"><button class="btn primary" type="button" id="copyShoppingList">העתקת הרשימה</button><button class="btn ghost" type="button" id="backShoppingBuilder">חזרה לבחירה</button></div></div>`; modal.querySelector(".close").onclick=()=>modal.classList.remove("open"); modal.querySelector("#backShoppingBuilder").onclick=showPicker; modal.querySelector("#copyShoppingList").onclick=async()=>{try{await navigator.clipboard.writeText([...items].map(([item,count])=>`${item}${count>1?` (${count}x)`:""}`).join("\n"));toast("העתקנו את רשימת הקניות.")}catch{toast("לא הצלחנו להעתיק את הרשימה")}}; };
    }; showPicker();
  };

  addEnhancementStyles(); renderEventRecipes();

  window.addEventListener("focus", () => { if (shared.ready) refreshShared().catch(() => {}); });
  initializeShared();
})();