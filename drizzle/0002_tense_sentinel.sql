ALTER TABLE `product_records` ADD `purchaseUnitPrice` varchar(32) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `product_records` ADD `firstLegShippingFee` varchar(32) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `product_records` ADD `lastLegShippingFee` varchar(32) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `product_records` ADD `overseasWarehouseFee` varchar(32) DEFAULT '' NOT NULL;