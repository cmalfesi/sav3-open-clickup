CREATE TABLE `AccessAudit` (
	`id` text PRIMARY KEY NOT NULL,
	`actorId` text NOT NULL,
	`action` text NOT NULL,
	`targetId` text NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `AccountAccess` (
	`userId` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL,
	`scopeAll` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `AuthThrottle` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`resetAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Dashboard` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sources` text DEFAULT '[]' NOT NULL,
	`createdBy` text NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Invitation` (
	`id` text PRIMARY KEY NOT NULL,
	`tokenHash` text NOT NULL,
	`userId` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`scopeAll` integer DEFAULT 0 NOT NULL,
	`grants` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`revoked` integer DEFAULT 0 NOT NULL,
	`accepted` text,
	`createdAt` integer NOT NULL,
	`createdBy` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Invitation_tokenHash_unique` ON `Invitation` (`tokenHash`);--> statement-breakpoint
CREATE TABLE `ResourceGrant` (
	`userId` text NOT NULL,
	`resourceType` text NOT NULL,
	`resourceId` text NOT NULL,
	`level` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ResourceGrant_user_resource` ON `ResourceGrant` (`userId`,`resourceType`,`resourceId`);--> statement-breakpoint
CREATE TABLE `ResourcePolicy` (
	`resourceType` text NOT NULL,
	`resourceId` text NOT NULL,
	`restricted` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ResourcePolicy_resource` ON `ResourcePolicy` (`resourceType`,`resourceId`);