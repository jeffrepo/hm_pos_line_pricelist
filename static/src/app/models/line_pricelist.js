/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { PosOrder } from "@point_of_sale/app/models/pos_order";
import { PosOrderline } from "@point_of_sale/app/models/pos_order_line";
import { ProductProduct } from "@point_of_sale/app/models/product_product";
import { computeComboItems } from "@point_of_sale/app/models/utils/compute_combo_items";

patch(PosOrderline.prototype, {
    setup(vals) {
        super.setup(...arguments);
        // Refunds retain the original price and tariff, including offline ones.
        if (this.refunded_orderline_id && !this.line_pricelist_id) {
            this.update({ line_pricelist_id: this.refunded_orderline_id.line_pricelist_id || false });
        }
    },

    getLinePricelist() {
        return this.line_pricelist_id || this.combo_parent_id?.line_pricelist_id || this.order_id.pricelist_id;
    },

    canSetLinePricelist() {
        return !this.refunded_orderline_id && !this.is_reward_line &&
            ["original", "manual"].includes(this.price_type) && !this.combo_parent_id;
    },

    setLinePricelist(pricelist) {
        this.order_id.assert_editable();
        if (!this.canSetLinePricelist()) {
            return false;
        }
        if (pricelist && (
            !this.config.use_pricelist ||
            !this.config.available_pricelist_ids.some((item) => item.id === pricelist.id) ||
            pricelist.currency_id?.id !== this.order_id.currency.id
        )) {
            return false;
        }
        this.update({ line_pricelist_id: pricelist || false });
        // Selecting a tariff deliberately replaces a manually entered price.
        // Existing explicit percentage discounts remain applied.
        this.price_type = "original";
        this.order_id.recomputeLinePricelistPrices();
        this.setDirty();
        return true;
    },

    recomputeLinePricelistPrice() {
        if (this.price_type !== "original" || this.refunded_orderline_id || this.is_reward_line || this.combo_parent_id) {
            return;
        }
        const pricelist = this.getLinePricelist();
        if (this.combo_line_ids?.length) {
            const prices = computeComboItems(
                this.product_id,
                this.combo_line_ids.map((line) => ({
                    combo_item_id: line.combo_item_id,
                    configuration: { attribute_value_ids: line.attribute_value_ids.map((value) => value.id) },
                })),
                pricelist,
                this.models["decimal.precision"].getAll(),
                this.models["product.template.attribute.value"].getAllBy("id"),
                this.config.currency_id
            );
            for (const child of this.combo_line_ids) {
                if (child.price_type === "original") {
                    child.set_unit_price(prices.find((item) => item.combo_item_id.id === child.combo_item_id.id).price_unit);
                }
            }
        } else if (this.isLotTracked()) {
            const related = [];
            const price = this.product_id.get_price(
                pricelist, this.get_quantity(), this.get_price_extra(), false, false, this, related
            );
            related.filter((line) => line.price_type === "original" && !line.refunded_orderline_id)
                .forEach((line) => line.set_unit_price(price));
        } else {
            this.set_unit_price(this.product_id.get_price(pricelist, this.get_quantity(), this.get_price_extra()));
        }
    },

    set_quantity(quantity, keep_price) {
        const explicit = Boolean(this.line_pricelist_id);
        const result = super.set_quantity(quantity, keep_price || explicit);
        if (result === true && explicit && !keep_price) {
            this.recomputeLinePricelistPrice();
        }
        return result;
    },

    can_be_merged_with(other) {
        // Explicit choices remain independent, even when their prices coincide.
        if (this.line_pricelist_id || other.line_pricelist_id) {
            return false;
        }
        return super.can_be_merged_with(...arguments);
    },

    display_discount_policy() {
        if (!this.line_pricelist_id && !this.combo_parent_id?.line_pricelist_id) {
            return super.display_discount_policy(...arguments);
        }
        const rule = this.product_id.getPricelistRule(this.getLinePricelist(), this.get_quantity());
        return rule?.compute_price === "percentage" ? "without_discount" : "with_discount";
    },

    getDisplayData() {
        const pricelist = this.line_pricelist_id || this.combo_parent_id?.line_pricelist_id;
        return { ...super.getDisplayData(...arguments), hmLinePricelistName: pricelist?.name || "" };
    },
});

patch(ProductProduct.prototype, {
    get_price(pricelist, quantity, price_extra = 0, recurring = false, list_price = false, original_line = false, related_lines = []) {
        if (original_line?.isLotTracked() && original_line.order_id.lines.some((line) => line.line_pricelist_id)) {
            // Native lot pricing aggregates the whole product. Isolate tariff
            // groups so a different list cannot affect their quantity tier.
            const group = original_line.order_id.lines.filter((line) =>
                line.product_id.id === this.id &&
                (line.line_pricelist_id?.id || false) === (original_line.line_pricelist_id?.id || false) &&
                line.get_price_extra() === original_line.get_price_extra() &&
                line.price_type === "original" && !line.refunded_orderline_id && !line.is_reward_line
            );
            related_lines.push(...group);
            return super.get_price(
                original_line.getLinePricelist(),
                group.reduce((total, line) => total + line.get_quantity(), 0),
                price_extra, recurring, list_price
            );
        }
        return super.get_price(...arguments);
    },
});

patch(PosOrder.prototype, {
    recomputeLinePricelistPrices() {
        for (const line of this.lines) {
            line.recomputeLinePricelistPrice();
        }
    },

    set_pricelist(pricelist) {
        const result = super.set_pricelist(...arguments);
        if (this.lines.some((line) => line.line_pricelist_id)) {
            this.recomputeLinePricelistPrices();
        }
        return result;
    },

    removeOrderline(line) {
        const hadOverrides = this.lines.some((item) => item.line_pricelist_id);
        const result = super.removeOrderline(...arguments);
        if (hadOverrides && result) {
            this.recomputeLinePricelistPrices();
        }
        return result;
    },
});
