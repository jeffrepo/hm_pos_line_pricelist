/** @odoo-module **/
/* global posmodel */
import { registry } from "@web/core/registry";
import * as ProductScreen from "@point_of_sale/../tests/tours/utils/product_screen_util";
import * as Chrome from "@point_of_sale/../tests/tours/utils/chrome_util";
import * as Common from "@point_of_sale/../tests/tours/utils/common";

function equal(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
    }
}

function selectTariff(name) {
    return [
        ...ProductScreen.clickControlButtonMore(),
        { trigger: ".o_line_pricelist_button", run: "click" },
        { trigger: `.selection-item:contains('${name}')`, run: "click" },
    ];
}

registry.category("web_tour.tours").add("hm_line_pricelist", {
    steps: () => [
        ...Chrome.startPoS(),
        ...ProductScreen.clickDisplayedProduct("HM Test Product"),
        ...selectTariff("HM Wholesale"),
        { trigger: ".orderline.selected .hm-line-pricelist:contains('HM Wholesale')" },
        {
            trigger: ".product-screen",
            run() {
                const line = posmodel.get_order().get_selected_orderline();
                equal(line.price_unit, 80, "selected tariff");
                line.set_quantity(10);
                equal(line.price_unit, 60, "quantity tier");
            },
        },
        ...ProductScreen.clickDisplayedProduct("HM Test Product"),
        ...ProductScreen.clickPriceList("HM Promotion"),
        {
            trigger: ".product-screen",
            run() {
                const order = posmodel.get_order();
                equal(order.lines.length, 2, "different tariff lines must not merge");
                const special = order.lines.find((line) => line.line_pricelist_id);
                equal(special.price_unit, 60, "global change preserves override");
                equal(order.get_selected_orderline().price_unit, 90, "global list prices ordinary line");
                order.select_orderline(special);
            },
        },
        ...selectTariff("Usar lista del pedido"),
        {
            trigger: ".product-screen",
            run() {
                const line = posmodel.get_order().get_selected_orderline();
                equal(Boolean(line.line_pricelist_id), false, "reset override");
                equal(line.price_unit, 90, "reset uses order price");
            },
        },
        ...selectTariff("HM Wholesale"),
        {
            trigger: ".product-screen",
            async run() {
                const order = posmodel.get_order();
                const line = order.get_selected_orderline();
                const wholesale = line.line_pricelist_id;
                line.price_type = "manual";
                line.set_unit_price(37);
                order.set_pricelist(order.pricelist_id);
                equal(line.price_unit, 37, "manual price remains manual");
                line.setLinePricelist(wholesale);
                line.set_quantity(1);
                equal(line.price_unit, 80, "explicit selection replaces manual price");
                equal(line.serialize().line_pricelist_id, wholesale.id, "offline serialization");
                equal(line.serialize({ orm: true }).line_pricelist_id, wholesale.id, "server serialization");

                const lotProduct = posmodel.models["product.product"].find((product) => product.name === "HM Lot Product");
                const lotA = await posmodel.addLineToOrder({ product_id: lotProduct }, order, { merge: false }, false);
                lotA.setLinePricelist(wholesale);
                lotA.set_quantity(9);
                const lotB = await posmodel.addLineToOrder({ product_id: lotProduct }, order, { merge: false }, false);
                equal(lotA.price_unit, 80, "other tariff lot must not change the tier");
                equal(lotB.price_unit, 90, "ordinary lot uses order list");
                lotB.setLinePricelist(wholesale);
                equal(lotA.price_unit, 60, "same tariff lots share quantity tier");
                equal(lotB.price_unit, 60, "same tariff group repriced");
                order.removeOrderline(lotB);
                equal(lotA.price_unit, 80, "deleting lot recomputes tier");
                order.removeOrderline(lotA);
                order.select_orderline(line);
                await posmodel.syncAllOrders({ orders: [order] });
                equal(typeof order.id, "number", "order was saved on server");
            },
        },
        Common.refresh(),
        { trigger: ".orderline .hm-line-pricelist:contains('HM Wholesale')" },
        {
            trigger: ".product-screen",
            run() {
                const line = posmodel.get_order().lines.find((item) => item.line_pricelist_id);
                equal(line.price_unit, 80, "restored price");
                equal(line.line_pricelist_id.name, "HM Wholesale", "restored tariff");
            },
        },
    ],
});
