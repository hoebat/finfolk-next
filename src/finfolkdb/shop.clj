(ns finfolkdb.shop
  "Portable Finnies shop publication for the current and fresh databases."
  (:require [clojure.java.io :as io]))

(def SQL
  "CREATE SCHEMA IF NOT EXISTS finfolk_shop;
GRANT USAGE ON SCHEMA finfolk_shop TO finfolk_api;
CREATE TABLE IF NOT EXISTS finfolk_shop.finnie_accounts (
 user_id uuid PRIMARY KEY, imported_points bigint NOT NULL DEFAULT 0, time_created bigint NOT NULL DEFAULT (extract(epoch FROM now())*1000000)::bigint);
CREATE TABLE IF NOT EXISTS finfolk_shop.finnie_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
 outlet text NOT NULL CHECK(length(outlet) BETWEEN 1 AND 160), description text NOT NULL DEFAULT '',
 instructions text NOT NULL DEFAULT '', cost integer NOT NULL CHECK(cost>0),
 stock integer CHECK(stock>=0), revision integer NOT NULL DEFAULT 1 CHECK(revision>0), active boolean NOT NULL DEFAULT false,
 expires_at bigint, time_updated bigint NOT NULL DEFAULT (extract(epoch FROM now())*1000000)::bigint);
CREATE TABLE IF NOT EXISTS finfolk_shop.finnie_redemptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES finfolk_shop.finnie_accounts(user_id),
 item_id uuid NOT NULL REFERENCES finfolk_shop.finnie_items(id), request_key uuid NOT NULL,
 code uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(), cost integer NOT NULL CHECK(cost>0),
 item_snapshot jsonb NOT NULL, status text NOT NULL DEFAULT 'claimed' CHECK(status IN ('claimed','fulfilled','refunded')),
 time_created bigint NOT NULL DEFAULT (extract(epoch FROM now())*1000000)::bigint, completed_at bigint,
 UNIQUE(user_id,request_key));
CREATE TABLE IF NOT EXISTS finfolk_shop.finnie_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES finfolk_shop.finnie_accounts(user_id),
 amount bigint NOT NULL CHECK(amount<>0), reference text NOT NULL, reason text NOT NULL,
 time_created bigint NOT NULL DEFAULT (extract(epoch FROM now())*1000000)::bigint, UNIQUE(user_id,reference));
CREATE INDEX IF NOT EXISTS finnie_redemptions_user ON finfolk_shop.finnie_redemptions(user_id,time_created DESC);
CREATE INDEX IF NOT EXISTS finnie_entries_user ON finfolk_shop.finnie_entries(user_id);
REVOKE ALL ON finfolk_shop.finnie_accounts,finfolk_shop.finnie_items,finfolk_shop.finnie_redemptions,finfolk_shop.finnie_entries FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON finfolk_shop.finnie_accounts,finfolk_shop.finnie_items,finfolk_shop.finnie_redemptions,finfolk_shop.finnie_entries TO finfolk_api;
")

(defn -main
  [& _]
  (io/make-parents "resources/finfolkdb/shop.sql")
  (spit "resources/finfolkdb/shop.sql" (str "-- Generated from finfolkdb.shop/SQL.\n" SQL)))
