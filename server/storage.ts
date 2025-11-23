import {
  users,
  menuGenerations,
  type User,
  type UpsertUser,
  type MenuGeneration,
  type InsertMenuGeneration,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByStripeCustomer(stripeCustomerId: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserStripeInfo(userId: string, stripeCustomerId: string, stripeSubscriptionId: string, subscriptionStatus: string): Promise<User>;

  // Menu generation operations
  createMenuGeneration(generation: InsertMenuGeneration): Promise<MenuGeneration>;
  getMenuGeneration(id: string): Promise<MenuGeneration | undefined>;
  getUserGenerations(userId: string): Promise<MenuGeneration[]>;
  updateGenerationDesigns(id: string, htmlDesigns: string[]): Promise<void>;
  selectGenerationVariation(id: string, variation: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByStripeCustomer(stripeCustomerId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, stripeCustomerId));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserStripeInfo(
    userId: string,
    stripeCustomerId: string,
    stripeSubscriptionId: string,
    subscriptionStatus: string
  ): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        stripeCustomerId,
        stripeSubscriptionId,
        subscriptionStatus,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async createMenuGeneration(generation: InsertMenuGeneration): Promise<MenuGeneration> {
    const [menuGen] = await db
      .insert(menuGenerations)
      .values(generation)
      .returning();
    return menuGen;
  }

  async getMenuGeneration(id: string): Promise<MenuGeneration | undefined> {
    const [generation] = await db
      .select()
      .from(menuGenerations)
      .where(eq(menuGenerations.id, id));
    return generation;
  }

  async getUserGenerations(userId: string): Promise<MenuGeneration[]> {
    const generations = await db
      .select()
      .from(menuGenerations)
      .where(eq(menuGenerations.userId, userId))
      .orderBy(desc(menuGenerations.createdAt));
    return generations;
  }

  async updateGenerationDesigns(id: string, htmlDesigns: string[]): Promise<void> {
    await db
      .update(menuGenerations)
      .set({ htmlDesigns })
      .where(eq(menuGenerations.id, id));
  }

  async selectGenerationVariation(id: string, variation: number): Promise<void> {
    await db
      .update(menuGenerations)
      .set({ selectedVariation: variation })
      .where(eq(menuGenerations.id, id));
  }
}

export const storage = new DatabaseStorage();
