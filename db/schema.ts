import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const scores = sqliteTable('scores', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  playerName: text('player_name').notNull(),
  normalizedName: text('normalized_name').notNull(),
  level: integer('level').notNull(),
  score: integer('score').notNull(),
  wpm: integer('wpm').notNull(),
  accuracy: integer('accuracy').notNull(),
  hp: integer('hp').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
}, (table) => [
  uniqueIndex('scores_player_level_idx').on(table.normalizedName, table.level),
  index('scores_ranking_idx').on(table.score, table.updatedAt)
]);
