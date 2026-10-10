CREATE TABLE `database_connection` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`type_id` text NOT NULL,
	`settings` text NOT NULL,
	`encrypted_secrets` text,
	`created_by` text,
	`last_sync_at` integer,
	`last_sync_ok` integer,
	`last_sync_message` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `database_connection_project_name_idx` ON `database_connection` (`project_id`,`name`);