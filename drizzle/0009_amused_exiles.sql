CREATE TABLE `HierarchyTemplate` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`config` text NOT NULL,
	`createdBy` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `TemplateMetadata` (
	`templateId` text PRIMARY KEY NOT NULL,
	`config` text NOT NULL,
	FOREIGN KEY (`templateId`) REFERENCES `TaskTemplate`(`id`) ON UPDATE no action ON DELETE cascade
);
