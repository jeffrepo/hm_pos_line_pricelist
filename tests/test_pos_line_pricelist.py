from odoo import Command
from odoo.exceptions import ValidationError
from odoo.tests import tagged
from odoo.addons.point_of_sale.tests.common import TestPoSCommon


@tagged("post_install", "-at_install")
class TestPosLinePricelist(TestPoSCommon):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.wholesale = cls.currency_pricelist.copy({"name": "HM Wholesale"})
        cls.basic_config.write({
            "use_pricelist": True,
            "available_pricelist_ids": [Command.link(cls.wholesale.id)],
        })
        cls.product = cls.env["product.product"].create({
            "name": "HM Product", "list_price": 100, "available_in_pos": True,
            "taxes_id": [Command.clear()],
        })

    def setUp(self):
        super().setUp()
        self.config = self.basic_config
        self.open_new_session()
        self.order = self.env["pos.order"].create({
            "session_id": self.pos_session.id, "pricelist_id": self.currency_pricelist.id,
            "amount_tax": 0, "amount_total": 80, "amount_paid": 0, "amount_return": 0,
        })

    def _line(self, **values):
        return self.env["pos.order.line"].create({
            "order_id": self.order.id, "product_id": self.product.id,
            "qty": 1, "price_unit": 80, "price_subtotal": 80, "price_subtotal_incl": 80,
            "line_pricelist_id": self.wholesale.id, **values,
        })

    def test_saved_and_loaded_for_pos(self):
        line = self._line()
        fields = line._load_pos_data_fields(self.config.id)
        self.assertIn("line_pricelist_id", fields)
        self.assertEqual(line.read(fields, load=False)[0]["line_pricelist_id"], self.wholesale.id)
        self.assertEqual(line.copy().line_pricelist_id, self.wholesale)

    def test_unavailable_list_rejected(self):
        unavailable = self.wholesale.copy({"name": "Unavailable"})
        with self.assertRaises(ValidationError), self.cr.savepoint():
            self._line(line_pricelist_id=unavailable.id)

    def test_foreign_currency_rejected(self):
        foreign = self.wholesale.copy({"currency_id": self.other_currency.id})
        with self.assertRaises(ValidationError), self.cr.savepoint():
            self._line(line_pricelist_id=foreign.id)

    def test_other_company_rejected(self):
        company = self.env["res.company"].create({"name": "Other HM Company"})
        foreign = self.wholesale.copy({"company_id": company.id})
        with self.assertRaises(ValidationError), self.cr.savepoint():
            self._line(line_pricelist_id=foreign.id)

    def test_refund_retains_tariff_and_original_price(self):
        original = self._line()
        refund = self._line(
            qty=-1, refunded_orderline_id=original.id,
            line_pricelist_id=False, price_subtotal=-80, price_subtotal_incl=-80,
        )
        self.assertEqual(refund.line_pricelist_id, self.wholesale)
        self.assertEqual(refund.price_unit, original.price_unit)
        with self.assertRaises(ValidationError), self.cr.savepoint():
            refund.line_pricelist_id = False

    def test_paid_order_cannot_change_tariff(self):
        line = self._line()
        self.order.state = "paid"
        with self.assertRaises(ValidationError), self.cr.savepoint():
            line.line_pricelist_id = False

    def test_pricelist_currency_loaded(self):
        fields = self.wholesale._load_pos_data_fields(self.config.id)
        self.assertIn("currency_id", fields)
        self.assertIn("company_id", fields)
