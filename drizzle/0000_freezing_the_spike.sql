CREATE TABLE `scores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`level` integer NOT NULL,
	`score` integer NOT NULL,
	`wpm` integer NOT NULL,
	`accuracy` integer NOT NULL,
	`hp` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scores_player_level_idx` ON `scores` (`normalized_name`,`level`);--> statement-breakpoint
CREATE INDEX `scores_ranking_idx` ON `scores` (`score`,`updated_at`);