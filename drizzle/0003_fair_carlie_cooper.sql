CREATE TABLE `DashboardDocument` (
	`dashboardId` text PRIMARY KEY NOT NULL,
	`config` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`writeKey` text NOT NULL,
	`archived` integer DEFAULT 0 NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`dashboardId`) REFERENCES `Dashboard`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `DashboardHistory` (
	`id` text PRIMARY KEY NOT NULL,
	`dashboardId` text NOT NULL,
	`actorId` text NOT NULL,
	`revision` integer NOT NULL,
	`name` text NOT NULL,
	`config` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`dashboardId`) REFERENCES `Dashboard`(`id`) ON UPDATE no action ON DELETE cascade
);
