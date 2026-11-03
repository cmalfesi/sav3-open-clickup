CREATE TABLE `UserListPreference` (
	`userId` text NOT NULL,
	`listId` text NOT NULL,
	`activeViewId` text,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`listId`) REFERENCES `List`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`activeViewId`) REFERENCES `View`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `UserListPreference_user_list` ON `UserListPreference` (`userId`,`listId`);--> statement-breakpoint
CREATE TABLE `UserViewPreference` (
	`userId` text NOT NULL,
	`viewId` text NOT NULL,
	`state` text DEFAULT '{}' NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`viewId`) REFERENCES `View`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `UserViewPreference_user_view` ON `UserViewPreference` (`userId`,`viewId`);