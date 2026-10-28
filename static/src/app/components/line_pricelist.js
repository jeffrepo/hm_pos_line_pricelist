/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { _t } from "@web/core/l10n/translation";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { makeAwaitable } from "@point_of_sale/app/store/make_awaitable_dialog";
import { SelectionPopup } from "@point_of_sale/app/utils/input_popups/selection_popup";
import { ControlButtons } from "@point_of_sale/app/screens/product_screen/control_buttons/control_buttons";

patch(ControlButtons.prototype, {
    async clickLinePricelist() {
        const order = this.pos.get_order();
        const selected = order?.get_selected_orderline();
        const line = selected?.combo_parent_id || selected;
        if (!line || !line.canSetLinePricelist()) {
            this.dialog.add(AlertDialog, {
                title: _t("Tarifa de línea"),
                body: _t("Selecciona una línea de venta. Las devoluciones y recompensas conservan su precio original."),
            });
            return;
        }
        const list = [{
            id: "order",
            label: _t("Usar lista del pedido"),
            isSelected: !line.line_pricelist_id,
            item: { pricelist: false },
        }, ...this.pos.config.available_pricelist_ids
            .filter((pricelist) => pricelist.currency_id?.id === order.currency.id)
            .map((pricelist) => ({
                id: pricelist.id,
                label: pricelist.name,
                isSelected: line.line_pricelist_id?.id === pricelist.id,
                item: { pricelist },
            }))];
        const choice = await makeAwaitable(this.dialog, SelectionPopup, {
            title: _t("Lista de precios para: %s", line.get_full_product_name()),
            list,
        });
        // The dialog may outlive the selected order or line.
        if (choice && this.pos.get_order() === order && order.lines.includes(line) && !order.finalized) {
            line.setLinePricelist(choice.pricelist);
        }
    },
});
