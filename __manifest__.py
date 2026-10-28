{
    "name": "HM - Listas de precios por línea en POS",
    "version": "18.0.1.0.0",
    "summary": "Aplica una tarifa distinta a la línea seleccionada en caja",
    "author": "HM Express",
    "website": "https://github.com/jeffrepo/hm_pos_line_pricelist",
    "license": "LGPL-3",
    "category": "Sales/Point of Sale",
    "depends": ["point_of_sale"],
    "data": ["views/pos_order_views.xml"],
    "assets": {
        "point_of_sale._assets_pos": [
            "hm_pos_line_pricelist/static/src/app/models/line_pricelist.js",
            "hm_pos_line_pricelist/static/src/app/components/line_pricelist.js",
            "hm_pos_line_pricelist/static/src/app/components/orderline.js",
            "hm_pos_line_pricelist/static/src/xml/line_pricelist.xml",
            "hm_pos_line_pricelist/static/src/xml/orderline.xml",
        ],
        "point_of_sale.customer_display_assets": [
            "hm_pos_line_pricelist/static/src/app/components/orderline.js",
            "hm_pos_line_pricelist/static/src/xml/orderline.xml",
        ],
        "point_of_sale.assets_debug": ["hm_pos_line_pricelist/static/tests/tours/line_pricelist_tour.js"],
        "web.assets_tests": ["hm_pos_line_pricelist/static/tests/tours/line_pricelist_tour.js"],
    },
    "installable": True,
    "application": False,
}
