CREATE TABLE `ChangeEvent` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`taskId` text,
	`listId` text NOT NULL,
	`actorId` text NOT NULL,
	`clientId` text,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ChangeEvent_list_seq` ON `ChangeEvent` (`listId`,`seq`);--> statement-breakpoint
CREATE TABLE `IntegrationToken` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`name` text NOT NULL,
	`tokenHash` text NOT NULL,
	`scope` text NOT NULL,
	`createdAt` integer NOT NULL,
	`expiresAt` integer NOT NULL,
	`revoked` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `IntegrationToken_tokenHash_unique` ON `IntegrationToken` (`tokenHash`);--> statement-breakpoint
CREATE TABLE `NotificationPreference` (
	`userId` text PRIMARY KEY NOT NULL,
	`mentions` integer DEFAULT 1 NOT NULL,
	`assigned` integer DEFAULT 1 NOT NULL,
	`comments` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
