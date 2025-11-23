import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (mandatory for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (mandatory for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  subscriptionStatus: varchar("subscription_status"), // active, canceled, incomplete, etc.
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Menu generations table
export const menuGenerations = pgTable("menu_generations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  fileName: varchar("file_name").notNull(),
  extractedText: text("extracted_text").notNull(),
  colors: text("colors").array().notNull(),
  size: varchar("size").notNull(),
  stylePrompt: text("style_prompt").notNull(),
  selectedVariation: integer("selected_variation"), // 0, 1, or 2
  htmlDesigns: text("html_designs").array(), // Array of 3 HTML designs
  createdAt: timestamp("created_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const insertMenuGenerationSchema = createInsertSchema(menuGenerations).omit({
  id: true,
  createdAt: true,
});

export type InsertMenuGeneration = z.infer<typeof insertMenuGenerationSchema>;
export type MenuGeneration = typeof menuGenerations.$inferSelect;

// Available menu sizes
export const MENU_SIZES = [
  { value: "a4", label: "A4", dimensions: "8.3 × 11.7 in" },
  { value: "letter", label: "Letter", dimensions: "8.5 × 11 in" },
  { value: "square", label: "Square", dimensions: "11 × 11 in" },
  { value: "webpage", label: "Web Page", dimensions: "Responsive" },
  { value: "tall-poster", label: "Tall Poster", dimensions: "11 × 17 in" },
] as const;

export type MenuSize = typeof MENU_SIZES[number]['value'];
