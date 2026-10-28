from odoo import Command
from odoo.tests import tagged
from odoo.addons.point_of_sale.tests.test_frontend import TestPointOfSaleHttpCommon


@tagged("post_install", "-at_install")
class TestLinePricelistFrontend(TestPointOfSaleHttpCommon):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.hm_product = cls.env["product.product"].create({
            "name": "HM Test Product", "list_price": 100, "available_in_pos": True,
            "taxes_id": [Command.clear()],
        })
        cls.hm_lot_product = cls.env["product.product"].create({
            "name": "HM Lot Product", "tracking": "lot", "is_storable": True,
            "list_price": 100, "available_in_pos": True, "taxes_id": [Command.clear()],
        })
        combo = cls.env["product.combo"].create({
            "name": "HM Combo Choice",
            "combo_item_ids": [Command.create({"product_id": cls.hm_product.id})],
        })
        cls.env["product.product"].create({
            "name": "HM Combo Product", "type": "combo", "combo_ids": [Command.link(combo.id)],
            "list_price": 100, "available_in_pos": True, "taxes_id": [Command.clear()],
        })
        lists = cls.env["product.pricelist"]
        for name, price in [("HM Retail", 100), ("HM Wholesale", 80), ("HM Promotion", 90)]:
            lists |= cls.env["product.pricelist"].create({
                "name": name, "currency_id": cls.env.company.currency_id.id,
                "item_ids": [Command.create({
                    "applied_on": "3_global", "compute_price": "fixed", "fixed_price": price,
                })],
            })
        cls.hm_wholesale = lists[1]
        cls.env["product.pricelist.item"].create({
            "pricelist_id": cls.hm_wholesale.id, "min_quantity": 10,
            "applied_on": "3_global", "compute_price": "fixed", "fixed_price": 60,
        })
        cls.main_pos_config.write({
            "use_pricelist": True, "pricelist_id": lists[0].id,
            "available_pricelist_ids": [Command.set(lists.ids)],
        })
        cls.main_pos_config.picking_type_id.use_create_lots = True

    def test_line_pricelist_ui_and_persistence(self):
        self.main_pos_config.with_user(self.pos_user).open_ui()
        self.main_pos_config.current_session_id.set_opening_control(0, None)
        self.start_pos_tour("hm_line_pricelist", login="pos_user")
        lines = self.env["pos.order.line"].search([
            ("order_id.session_id", "=", self.main_pos_config.current_session_id.id),
            ("product_id", "=", self.hm_product.id),
        ])
        special = lines.filtered("line_pricelist_id")
        self.assertEqual(len(special), 1)
        self.assertEqual(special.line_pricelist_id, self.hm_wholesale)
        self.assertEqual(special.price_unit, 80)
        self.assertEqual(special.qty, 1)
