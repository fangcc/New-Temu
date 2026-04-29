ALTER TABLE `product_records` ADD `mainSellingPoints` text NOT NULL;--> statement-breakpoint
ALTER TABLE `product_records` ADD `coreSellingPoint` text NOT NULL;--> statement-breakpoint
ALTER TABLE `product_records` ADD `targetAudience` text NOT NULL;--> statement-breakpoint
ALTER TABLE `product_records` ADD `existingEnglishTitle` varchar(255) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `product_records` ADD `optimizedEnglishTitle` varchar(255) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `product_records` ADD `optimizedMainImageUrl` text NOT NULL;