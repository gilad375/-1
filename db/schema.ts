import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const recipes = sqliteTable("recipes", {
  id: text("id").primaryKey(), name: text("name").notNull(),
  author: text("author").notNull().default("המשפחה"),
  category: text("category").notNull().default("ארוחות ערב"),
  time: text("time").notNull().default(""), servings: text("servings").notNull().default(""),
  difficulty: text("difficulty").notNull().default("קל"), story: text("story").notNull().default(""),
  origin: text("origin").notNull().default(""),
  dedication: text("dedication").notNull().default(""),
  dietaryTag: text("dietary_tag").notNull().default("לא צוין"),
  ingredients: text("ingredients").notNull().default(""), steps: text("steps").notNull().default(""),
  glutenFree: integer("gluten_free", { mode: "boolean" }).notNull().default(false),
  videoKey: text("video_key"),
  createdAt: integer("created_at").notNull(),
});

export const recipeImages = sqliteTable("recipe_images", {
  id: text("id").primaryKey(),
  recipeId: text("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
  objectKey: text("object_key").notNull().unique(), position: integer("position").notNull().default(0),
}, (table) => [index("idx_recipe_images_recipe_id").on(table.recipeId)]);

export const recipeComments = sqliteTable("recipe_comments", {
  id: text("id").primaryKey(),
  recipeId: text("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
  authorName: text("author_name").notNull(), body: text("body").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [index("idx_recipe_comments_recipe_created").on(table.recipeId, table.createdAt)]);

export const recipeApprovals = sqliteTable("recipe_approvals", {
  id: text("id").primaryKey(),
  recipeId: text("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
  memberName: text("member_name").notNull(), createdAt: integer("created_at").notNull(),
}, (table) => [uniqueIndex("idx_recipe_approvals_recipe_member").on(table.recipeId, table.memberName)]);

export const recipeTryouts = sqliteTable("recipe_tryouts", {
  id: text("id").primaryKey(), recipeId: text("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
  memberName: text("member_name").notNull(), imageKey: text("image_key").notNull(), createdAt: integer("created_at").notNull(),
}, (table) => [index("idx_recipe_tryouts_recipe_created").on(table.recipeId, table.createdAt)]);

export const familyMenus = sqliteTable("family_menus", {
  id: text("id").primaryKey(), title: text("title").notNull(), recipeIds: text("recipe_ids").notNull(), createdAt: integer("created_at").notNull(),
});

export const familyStories = sqliteTable("family_stories", {
  id: text("id").primaryKey(), authorName: text("author_name").notNull(), title: text("title").notNull(), body: text("body").notNull(),
  imageKey: text("image_key"), createdAt: integer("created_at").notNull(),
}, (table) => [index("idx_family_stories_created").on(table.createdAt)]);

export const familyMealPlans = sqliteTable("family_meal_plans", {
  id: text("id").primaryKey(), dayKey: text("day_key").notNull(), recipeId: text("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
  authorName: text("author_name").notNull(), createdAt: integer("created_at").notNull(),
}, (table) => [index("idx_family_meal_plans_day").on(table.dayKey)]);

export const familyPolls = sqliteTable("family_polls", {
  id: text("id").primaryKey(), title: text("title").notNull(), optionsJson: text("options_json").notNull(), votesJson: text("votes_json").notNull(), createdAt: integer("created_at").notNull(),
});

export const familyEvents = sqliteTable("family_events", {
  id: text("id").primaryKey(), title: text("title").notNull(), eventDate: text("event_date").notNull(), recipeId: text("recipe_id").references(() => recipes.id, { onDelete: "set null" }), createdAt: integer("created_at").notNull(),
}, (table) => [index("idx_family_events_date").on(table.eventDate)]);

export const familyMemories = sqliteTable("family_memories", {
  id: text("id").primaryKey(), authorName: text("author_name").notNull(), title: text("title").notNull(), body: text("body").notNull(),
  imageKey: text("image_key"), audioKey: text("audio_key"), videoUrl: text("video_url"), createdAt: integer("created_at").notNull(),
}, (table) => [index("idx_family_memories_created").on(table.createdAt)]);

export const familyMembers = sqliteTable("family_members", {
  id: text("id").primaryKey(), name: text("name").notNull().unique(),
  bio: text("bio").notNull().default(""), photoKey: text("photo_key"), createdAt: integer("created_at").notNull(),
});

export const siteSettings = sqliteTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const feedback = sqliteTable("feedback", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default("אנונימי"),
  type: text("type").notNull().default("משוב"),
  message: text("message").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  senderName: text("sender_name").notNull(),
  recipientName: text("recipient_name").notNull(),
  body: text("body").notNull(),
  kind: text("kind").notNull().default("direct"),
  createdAt: integer("created_at").notNull(),
  readAt: integer("read_at"),
}, (table) => [
  index("idx_messages_recipient_created").on(table.recipientName, table.createdAt),
  index("idx_messages_sender_created").on(table.senderName, table.createdAt),
]);
