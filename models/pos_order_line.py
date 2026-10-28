from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class PosOrderLine(models.Model):
    _inherit = "pos.order.line"

    line_pricelist_id = fields.Many2one(
        "product.pricelist", string="Lista de precios de la línea",
        check_company=True, ondelete="restrict",
        help="Vacío significa que la línea usa la lista de precios del pedido.",
    )

    @api.model
    def _load_pos_data_fields(self, config_id):
        return super()._load_pos_data_fields(config_id) + ["line_pricelist_id"]

    @api.model_create_multi
    def create(self, vals_list):
        vals_list = [dict(values) for values in vals_list]
        for values in vals_list:
            if values.get("refunded_orderline_id"):
                original = self.browse(values["refunded_orderline_id"])
                values["line_pricelist_id"] = original.line_pricelist_id.id
        lines = super().create(vals_list)
        lines._check_selectable_line_pricelist()
        return lines

    def write(self, values):
        changed = self.browse()
        if "line_pricelist_id" in values:
            changed = self.filtered(
                lambda line: line.line_pricelist_id.id != values["line_pricelist_id"]
            )
            if changed.filtered(lambda line: line.order_id.state != "draft" or line.refunded_orderline_id):
                raise ValidationError(_("No se puede cambiar la tarifa de una venta cerrada ni de una devolución."))
        result = super().write(values)
        changed._check_selectable_line_pricelist()
        return result

    def _check_selectable_line_pricelist(self):
        for line in self.filtered(lambda line: line.line_pricelist_id and not line.refunded_orderline_id):
            if line.line_pricelist_id not in line.order_id.config_id._get_available_pricelists():
                raise ValidationError(_("La lista seleccionada no está habilitada en este punto de venta."))
            if line.combo_parent_id:
                raise ValidationError(_("Seleccione la tarifa en el producto principal del combo."))

    @api.constrains("line_pricelist_id", "order_id")
    def _check_line_pricelist(self):
        for line in self.filtered("line_pricelist_id"):
            pricelist = line.line_pricelist_id
            if pricelist.currency_id != line.order_id.currency_id:
                raise ValidationError(_("La tarifa de la línea debe tener la misma moneda que el pedido."))
            if pricelist.company_id and pricelist.company_id != line.company_id:
                raise ValidationError(_("La tarifa de la línea debe pertenecer a la compañía del pedido."))

    def _prepare_refund_data(self, refund_order, PosOrderLineLot):
        values = super()._prepare_refund_data(refund_order, PosOrderLineLot)
        values["line_pricelist_id"] = self.line_pricelist_id.id
        return values
