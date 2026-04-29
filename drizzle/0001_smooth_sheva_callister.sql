CREATE TABLE `product_records` (
	`id` varchar(64) NOT NULL,
	`productName` varchar(255) NOT NULL,
	`sourceCollectionUrl` text NOT NULL,
	`supplierUrl` text NOT NULL,
	`listingDate` varchar(10) NOT NULL,
	`costPrice` varchar(32) NOT NULL DEFAULT '',
	`salePrice` varchar(32) NOT NULL DEFAULT '',
	`weight` varchar(32) NOT NULL DEFAULT '',
	`note` text NOT NULL,
	`imageUrlsJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_records_id` PRIMARY KEY(`id`)
);
